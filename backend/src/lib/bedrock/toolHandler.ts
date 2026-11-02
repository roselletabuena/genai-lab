const CALENDAR_URL = process.env.CALENDAR_URL ?? "https://cal.com/roselle-tabuena/30min";
const CALENDAR_TOOL_NAME = "get_calendar_link";

export const TOOL_CONFIG = {
  tools: [
    {
      toolSpec: {
        name: CALENDAR_TOOL_NAME,
        description:
          "Retrieves the Cal.com scheduling page URL for booking a meeting or scheduling an interview with Roselle Tabuena.",
        inputSchema: { json: { type: "object", properties: {} } },
      },
    },
  ],
};

/**
 * Executes every tool-use block in an accumulated assistant turn.
 * Returns the Bedrock tool-result content and the calendar URL if the calendar
 * tool was invoked.
 */
export function resolveToolCalls(accumulatedContent: any[]): {
  toolResultsContent: any[];
  calendarUrl: string | undefined;
} {
  let calendarUrl: string | undefined;
  const toolResultsContent: any[] = [];

  for (const block of accumulatedContent) {
    if (!block.toolUse) continue;
    const { toolUseId, name } = block.toolUse;
    let resultData: any = {};

    if (name === CALENDAR_TOOL_NAME) {
      calendarUrl = CALENDAR_URL;
      resultData = {
        message: "A calendar widget is available for booking a meeting with Roselle.",
      };
    }

    toolResultsContent.push({
      toolResult: { toolUseId, status: "success", content: [{ json: resultData }] },
    });
  }

  return { toolResultsContent, calendarUrl };
}
