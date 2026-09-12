import { verifySlackSignature, openSlackView } from "@/lib/slack";
import { TEAMS } from "@/lib/teams";

export const runtime = "nodejs"; // needs Node's crypto — don't switch this to "edge"

const PRIORITY_OPTIONS = [
  { text: "Low", value: "low" },
  { text: "Medium", value: "med" },
  { text: "High", value: "high" },
];

/**
 * Handles Slack "interactivity" — button clicks and modal submissions.
 *
 * Slack app setup:
 *  1. api.slack.com/apps -> your app -> "Interactivity & Shortcuts" -> toggle On
 *  2. Request URL: https://<netlify-domain>/api/slack/interactions
 *  3. Save, then reinstall the app if prompted.
 *
 * Interactivity payloads need a response within 3 seconds, so DB work here is always deferred to
 * a background function (see the three cases below) — except views.open itself, which HAS to
 * happen inline: the trigger_id it needs only comes from, and is only valid right after, this
 * exact interaction.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  const isValid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    timestamp,
    rawBody,
    signature,
  });
  if (!isValid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Interactivity payloads arrive as a single "payload" form field containing JSON.
  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get("payload") ?? "{}");

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];

    if (action?.action_id === "create_task_from_alert") {
      const { insightId, title } = JSON.parse(action.value);

      await fetch(new URL("/.netlify/functions/slack-create-task-from-insight-background", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insightId,
          title,
          userId: payload.user?.id,
          channelId: payload.channel?.id,
          threadTs: payload.message?.ts,
        }),
      });

      return Response.json({ ok: true });
    }

    if (action?.action_id === "open_task_modal") {
      const metadata = JSON.parse(action.value);

      await openSlackView({
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "task_details_modal",
          private_metadata: JSON.stringify(metadata),
          title: { type: "plain_text", text: "Task details" },
          submit: { type: "plain_text", text: "Create task" },
          close: { type: "plain_text", text: "Cancel" },
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*${metadata.title}*\nfor *${metadata.brandName}*` },
            },
            {
              type: "input",
              block_id: "team_block",
              label: { type: "plain_text", text: "Department" },
              element: {
                type: "static_select",
                action_id: "team_input",
                placeholder: { type: "plain_text", text: "Select a department" },
                options: TEAMS.map((t) => ({ text: { type: "plain_text", text: t }, value: t })),
              },
            },
            {
              type: "input",
              block_id: "assignee_block",
              optional: true,
              label: { type: "plain_text", text: "Assignee" },
              element: {
                type: "plain_text_input",
                action_id: "assignee_input",
                placeholder: { type: "plain_text", text: "e.g. Joey" },
              },
            },
            {
              type: "input",
              block_id: "due_date_block",
              label: { type: "plain_text", text: "Due date" },
              element: { type: "datepicker", action_id: "due_date_input" },
            },
            {
              type: "input",
              block_id: "priority_block",
              label: { type: "plain_text", text: "Priority" },
              element: {
                type: "static_select",
                action_id: "priority_input",
                options: PRIORITY_OPTIONS.map((p) => ({
                  text: { type: "plain_text", text: p.text },
                  value: p.value,
                })),
                ...(metadata.initialPriority
                  ? {
                      initial_option: {
                        text: { type: "plain_text", text: PRIORITY_OPTIONS.find((p) => p.value === metadata.initialPriority)!.text },
                        value: metadata.initialPriority,
                      },
                    }
                  : {}),
              },
            },
          ],
        },
      });

      return Response.json({ ok: true });
    }
  }

  if (payload.type === "view_submission" && payload.view?.callback_id === "task_details_modal") {
    const metadata = JSON.parse(payload.view.private_metadata ?? "{}");
    const values = payload.view.state?.values ?? {};
    const assignee = values.assignee_block?.assignee_input?.value?.trim() || null;
    const team = values.team_block?.team_input?.selected_option?.value || null;
    const dueDate = values.due_date_block?.due_date_input?.selected_date || null;
    const priority = values.priority_block?.priority_input?.selected_option?.value || null;

    await fetch(new URL("/.netlify/functions/slack-finalize-task-background", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: metadata.title,
        brandId: metadata.brandId,
        brandName: metadata.brandName,
        assignee,
        team,
        dueDate,
        priority,
        userId: metadata.userId,
        channelId: metadata.channelId,
      }),
    });

    // response_action "clear" closes the modal immediately; the real confirmation posts to the
    // channel a moment later once slack-finalize-task-background.ts finishes.
    return Response.json({ response_action: "clear" });
  }

  return Response.json({ ok: true });
}
