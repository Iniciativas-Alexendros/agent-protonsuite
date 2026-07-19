/**
 * Tests para parseDriveConfig — cobertura de todas las branches:
 * - enabled: default, true, false
 * - cliBin: default, override
 * - stagingDir: default, override
 * - obsoleteExtensions: readCsv vacío → default, CSV con whitespace, CSV con entries vacíos
 */
import { describe, it, expect } from "vitest";
import { parseDriveConfig } from "../../src/config/drive.js";

function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...vars };
}

describe("parseDriveConfig", () => {
  describe("enabled", () => {
    it("defaults to true when unset", () => {
      const cfg = parseDriveConfig(env());
      expect(cfg.enabled).toBe(true);
    });

    it("returns true when DRIVE_ENABLED=true", () => {
      const cfg = parseDriveConfig(env({ DRIVE_ENABLED: "true" }));
      expect(cfg.enabled).toBe(true);
    });

    it("returns false when DRIVE_ENABLED=false", () => {
      const cfg = parseDriveConfig(env({ DRIVE_ENABLED: "false" }));
      expect(cfg.enabled).toBe(false);
    });

    it("returns false when DRIVE_ENABLED=0", () => {
      const cfg = parseDriveConfig(env({ DRIVE_ENABLED: "0" }));
      expect(cfg.enabled).toBe(false);
    });
  });

  describe("cliBin", () => {
    it("defaults to proton-drive when unset", () => {
      const cfg = parseDriveConfig(env());
      expect(cfg.cliBin).toBe("proton-drive");
    });

    it("uses custom value when set", () => {
      const cfg = parseDriveConfig(env({ DRIVE_CLI_BIN: "/custom/path/bin" }));
      expect(cfg.cliBin).toBe("/custom/path/bin");
    });
  });

  describe("stagingDir", () => {
    it("defaults to ~/.proton-drive/staging when unset", () => {
      const cfg = parseDriveConfig(env());
      expect(cfg.stagingDir).toBe("~/.proton-drive/staging");
    });

    it("uses custom value when set", () => {
      const cfg = parseDriveConfig(env({ DRIVE_STAGING_DIR: "/custom/staging" }));
      expect(cfg.stagingDir).toBe("/custom/staging");
    });
  });

  describe("obsoleteExtensions", () => {
    it("uses default list when DRIVE_OBSOLETE_EXTENSIONS is unset", () => {
      const cfg = parseDriveConfig(env());
      expect(cfg.obsoleteExtensions).toEqual([".doc", ".ppt", ".xls", ".bmp"]);
    });

    it("uses default list when DRIVE_OBSOLETE_EXTENSIONS is empty string", () => {
      const cfg = parseDriveConfig(env({ DRIVE_OBSOLETE_EXTENSIONS: "" }));
      expect(cfg.obsoleteExtensions).toEqual([".doc", ".ppt", ".xls", ".bmp"]);
    });

    it("parses CSV with whitespace", () => {
      const cfg = parseDriveConfig(
        env({ DRIVE_OBSOLETE_EXTENSIONS: ".pdf, .docx, .ppt" }),
      );
      expect(cfg.obsoleteExtensions).toEqual([".pdf", ".docx", ".ppt"]);
    });

    it("filters out empty entries from CSV", () => {
      const cfg = parseDriveConfig(
        env({ DRIVE_OBSOLETE_EXTENSIONS: ".pdf,,.docx,," }),
      );
      expect(cfg.obsoleteExtensions).toEqual([".pdf", ".docx"]);
    });

    it("handles single extension", () => {
      const cfg = parseDriveConfig(
        env({ DRIVE_OBSOLETE_EXTENSIONS: ".exe" }),
      );
      expect(cfg.obsoleteExtensions).toEqual([".exe"]);
    });
  });

  describe("combined defaults", () => {
    it("returns full default config when no env vars set", () => {
      const cfg = parseDriveConfig(env());
      expect(cfg).toEqual({
        enabled: true,
        cliBin: "proton-drive",
        stagingDir: "~/.proton-drive/staging",
        obsoleteExtensions: [".doc", ".ppt", ".xls", ".bmp"],
      });
    });

    it("returns full custom config when all env vars set", () => {
      const cfg = parseDriveConfig(
        env({
          DRIVE_ENABLED: "false",
          DRIVE_CLI_BIN: "/opt/bin/proton-drive",
          DRIVE_STAGING_DIR: "/mnt/drive/staging",
          DRIVE_OBSOLETE_EXTENSIONS: ".mp3,.wav,.flac",
        }),
      );
      expect(cfg).toEqual({
        enabled: false,
        cliBin: "/opt/bin/proton-drive",
        stagingDir: "/mnt/drive/staging",
        obsoleteExtensions: [".mp3", ".wav", ".flac"],
      });
    });
  });
});
