/**
 * Server settings — persisted in ~/.pi-browser-agent/settings.json.
 * Model choices live here so they survive server restarts and are never
 * hardcoded: if a model disappears upstream, the picker simply shows
 * what's live in the catalog and this file can be changed at runtime.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface InteractionModel {
	/** pi provider id, e.g. "ollama" */
	provider: string;
	/** model id within the provider, e.g. "nemotron-3-ultra" */
	modelId: string;
}

export interface ServerSettings {
	/** Vision model used for screenshot analysis (must be vision-capable). */
	visionModel?: string;
	/** Interaction model applied to new agent sessions (pi set_model). */
	interactionModel?: InteractionModel;
}

const SETTINGS_DIR = path.join(os.homedir(), ".pi-browser-agent");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "settings.json");

export function loadSettings(): ServerSettings {
	try {
		const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
		const parsed = JSON.parse(raw) as ServerSettings;
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

export function saveSettings(settings: ServerSettings): void {
	try {
		fs.mkdirSync(SETTINGS_DIR, { recursive: true });
		fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, "\t"));
	} catch (error) {
		console.error("[settings] failed to persist:", error);
	}
}