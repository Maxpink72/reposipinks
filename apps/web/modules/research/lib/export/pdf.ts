import "server-only";
import { logger } from "@formbricks/logger";

export type TPdfRenderOptions = {
  orientation?: "portrait" | "landscape";
  format?: "A4";
};

/**
 * Render print HTML to PDF via Playwright Chromium.
 * Requires: `pnpm exec playwright install chromium` (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH).
 */
export const renderHtmlToPdfBuffer = async (
  html: string,
  options: TPdfRenderOptions = {}
): Promise<Buffer> => {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch (error) {
    logger.error({ err: error }, "Playwright is not installed for research PDF export");
    const err = new Error("chromium_unavailable");
    err.name = "ChromiumUnavailableError";
    throw err;
  }

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>> | undefined;

  try {
    browser = await playwright.chromium.launch({
      headless: true,
      executablePath,
      args: ["--font-render-hinting=none", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- document.fonts in Chromium
      if ((document as any).fonts?.ready) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (document as any).fonts.ready;
      }
    });
    const pdf = await page.pdf({
      format: options.format ?? "A4",
      landscape: options.orientation === "landscape",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `<div style="width:100%;font-size:8px;color:#64748b;padding:0 16mm;font-family:sans-serif;display:flex;justify-content:space-between;">
        <span class="date"></span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
      margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Executable doesn't exist") ||
      message.includes("browserType.launch") ||
      message.includes("chromium_unavailable")
    ) {
      const err = new Error("chromium_unavailable");
      err.name = "ChromiumUnavailableError";
      throw err;
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
};
