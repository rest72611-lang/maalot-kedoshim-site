import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getPdfPageCount(sourcePath: string, sourceLabel: string): Promise<number> {
  let stdout: string;

  try {
    ({ stdout } = await execFileAsync("pdfinfo", [sourcePath]));
  } catch (error) {
    throw new Error(`Failed to read PDF "${sourceLabel}" with pdfinfo: ${describePopplerError(error)}`);
  }

  const match = /^Pages:\s+(\d+)/m.exec(stdout);
  if (!match || match[1] === undefined) {
    throw new Error(`Could not determine page count for PDF "${sourceLabel}" (pdfinfo output had no Pages line).`);
  }

  const pageCount = Number.parseInt(match[1], 10);
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error(`PDF "${sourceLabel}" reported an invalid page count (${match[1]}).`);
  }

  return pageCount;
}

export async function renderPdfPageToPng(options: {
  sourcePath: string;
  sourceLabel: string;
  pageNumber: number;
  dpi: number;
  outputPrefix: string;
}): Promise<string> {
  const { sourcePath, sourceLabel, pageNumber, dpi, outputPrefix } = options;

  try {
    await execFileAsync("pdftoppm", [
      "-r",
      String(dpi),
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      "-png",
      "-singlefile",
      sourcePath,
      outputPrefix,
    ]);
  } catch (error) {
    throw new Error(
      `Failed to render page ${pageNumber} of PDF "${sourceLabel}" with pdftoppm: ${describePopplerError(error)}`,
    );
  }

  return `${outputPrefix}.png`;
}

export function describePopplerError(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? "").trim();
    if (stderr.length > 0) {
      return stderr;
    }
  }

  return error instanceof Error ? error.message : String(error);
}
