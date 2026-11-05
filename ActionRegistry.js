/**
 * ActionRegistry resolves available actions, attribute setters, and service calls for Home Assistant entities.
 */
export class ActionRegistry {
    /**
     * Encode an action descriptor into a deterministic search result ID.
     * Format:
     *   - without extra payload: `${entityId}!${domain}.${service}`
     *   - with extra payload: `${entityId}!${domain}.${service}:${JSON.stringify(extraPayload)}`
     */
    static formatActionId(entityId, domain, service, extraData = {}) {
        const keys = Object.keys(extraData);
        if (keys.length === 0) {
            return `${entityId}!${domain}.${service}`;
        }
        return `${entityId}!${domain}.${service}:${JSON.stringify(extraData)}`;
    }

    /**
     * Decode an action result ID back into { entityId, domain, service, serviceData } if valid.
     * @param {string} resultId
     * @returns {null | { entityId: string, domain: string, service: string, serviceData: Object }}
     */
    static parseActionId(resultId) {
        const bangIndex = resultId.indexOf("!");
        if (bangIndex === -1) {
            return null;
        }

        const entityId = resultId.slice(0, bangIndex);
        const rest = resultId.slice(bangIndex + 1);
        const colonIndex = rest.indexOf(":");

        let domainService = rest;
        let extraData = {};

        if (colonIndex !== -1) {
            domainService = rest.slice(0, colonIndex);
            const jsonPart = rest.slice(colonIndex + 1);
            try {
                extraData = JSON.parse(jsonPart);
            } catch {
                extraData = {};
            }
        }

        const [domain, service] = domainService.split(".");
        if (!domain || !service) {
            return null;
        }

        return {
            entityId,
            domain,
            service,
            serviceData: {
                entity_id: entityId,
                ...extraData,
            },
        };
    }

    /**
     * Build a structured ActionDescriptor.
     */
    static createAction(entity, domain, service, label, extraData = {}, keywords = []) {
        const entityId = entity.entity_id;
        const id = this.formatActionId(entityId, domain, service, extraData);
        const extraKeys = Object.keys(extraData);
        const paramSummary =
            extraKeys.length > 0
                ? ` ${extraKeys.map((k) => `${k}=${JSON.stringify(extraData[k])}`).join(", ")}`
                : "";

        return {
            id,
            entityId,
            domain,
            service,
            serviceData: {
                entity_id: entityId,
                ...extraData,
            },
            label,
            description: `${entityId} (${domain}.${service}${paramSummary})`,
            keywords: [
                service.toLowerCase(),
                label.toLowerCase(),
                ...extraKeys.map((k) => k.toLowerCase()),
                ...keywords.map((k) => String(k).toLowerCase()),
            ],
        };
    }

    /**
     * Get the default action when activating an entity directly without "!".
     */
    static getDefaultAction(entity) {
        const entityId = typeof entity === "string" ? entity : entity.entity_id;
        const state = typeof entity === "object" ? entity?.state : undefined;
        const [domain] = entityId.split(".");

        switch (domain) {
            case "scene":
            case "script":
                return {
                    domain,
                    service: "turn_on",
                    serviceData: { entity_id: entityId },
                };
            case "button":
            case "input_button":
                return {
                    domain,
                    service: "press",
                    serviceData: { entity_id: entityId },
                };
            case "automation":
                return {
                    domain,
                    service: "trigger",
                    serviceData: { entity_id: entityId },
                };
            case "lock":
                return {
                    domain,
                    service: state === "locked" ? "unlock" : "lock",
                    serviceData: { entity_id: entityId },
                };
            default:
                return {
                    domain,
                    service: "toggle",
                    serviceData: { entity_id: entityId },
                };
        }
    }

    /**
     * Resolve candidate actions for an entity given the parsed action query and optional service catalog.
     * @param {Object} entity
     * @param {{ hasAction: boolean, actionTokens: string[], rawActionQuery: string }} actionQuery
     * @param {Object} [servicesCatalog]
     */
    static resolveActions(entity, actionQuery, servicesCatalog = null) {
        const [domain] = entity.entity_id.split(".");
        const baseActions = this._getBaseDomainActions(entity, domain, servicesCatalog);
        const attrActions = this._getAttributeListingActions(entity, domain);
        const allCatalogActions = [...baseActions, ...attrActions];

        const tokens = (actionQuery.actionTokens || []).map((t) => t.trim()).filter(Boolean);

        if (tokens.length === 0) {
            return allCatalogActions;
        }

        const keyValueActions = this._resolveAttributeKeyValueActions(entity, domain, tokens, servicesCatalog);
        const shorthandActions = this._resolveShorthandActions(entity, domain, tokens);
        const lowerTokens = tokens.map((t) => t.toLowerCase());
        const matchedCatalog = allCatalogActions.filter((action) =>
            lowerTokens.every((token) =>
                action.keywords.some((kw) => kw.includes(token))
            )
        );

        // Deduplicate by action ID, prioritizing bound key-value and shorthand actions first
        const seen = new Set();
        const combined = [];
        for (const act of [...keyValueActions, ...shorthandActions, ...matchedCatalog]) {
            if (!seen.has(act.id)) {
                seen.add(act.id);
                combined.push(act);
            }
        }
        return combined;
    }

    static _humanizeKey(key) {
        return key
            .split("_")
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
    }

    static _formatCurrentAttributeValue(attrKey, rawVal) {
        if (attrKey === "brightness" && typeof rawVal === "number") {
            return `${Math.round((rawVal / 255) * 100)}%`;
        }
        if (attrKey === "volume_level" && typeof rawVal === "number") {
            return `${Math.round(rawVal * 100)}%`;
        }
        if (Array.isArray(rawVal)) {
            return rawVal.join(", ");
        }
        return String(rawVal);
    }

    static _getAttributeSpecs(domain) {
        const specs = {
            light: [
                {
                    key: "brightness",
                    aliases: ["brightness", "brightness_pct", "dim", "level"],
                    service: "turn_on",
                    buildPayload: (val) => {
                        const num = Number(String(val).replace(/%$/, ""));
                        return Number.isNaN(num) ? null : { brightness_pct: num };
                    },
                    formatLabel: (val) => `Set brightness to ${String(val).replace(/%$/, "")}%`,
                },
                {
                    key: "color_temp_kelvin",
                    aliases: ["color_temp_kelvin", "kelvin", "color_temp", "ct"],
                    service: "turn_on",
                    buildPayload: (val) => {
                        const num = Number(String(val).replace(/k$/i, ""));
                        return Number.isNaN(num) ? null : { color_temp_kelvin: num };
                    },
                    formatLabel: (val) => `Set color temp kelvin to ${String(val).replace(/k$/i, "")}K`,
                },
                {
                    key: "color_name",
                    aliases: ["color_name", "color", "colour"],
                    service: "turn_on",
                    buildPayload: (val) => ({ color_name: String(val).toLowerCase() }),
                    formatLabel: (val) => `Set color to ${val}`,
                },
                {
                    key: "effect",
                    aliases: ["effect"],
                    service: "turn_on",
                    buildPayload: (val) => ({ effect: String(val) }),
                    formatLabel: (val) => `Set effect to ${val}`,
                },
            ],
            climate: [
                {
                    key: "temperature",
                    aliases: ["temperature", "temp"],
                    service: "set_temperature",
                    buildPayload: (val) => {
                        const num = Number(String(val).replace(/[cf°]$/i, ""));
                        return Number.isNaN(num) ? null : { temperature: num };
                    },
                    formatLabel: (val) => `Set temperature to ${val}°`,
                },
                {
                    key: "hvac_mode",
                    aliases: ["hvac_mode", "hvac_modes", "mode"],
                    service: "set_hvac_mode",
                    buildPayload: (val) => ({ hvac_mode: String(val).toLowerCase() }),
                    formatLabel: (val) => `Set HVAC mode to ${val}`,
                },
                {
                    key: "preset_mode",
                    aliases: ["preset_mode", "preset_modes", "preset"],
                    service: "set_preset_mode",
                    buildPayload: (val) => ({ preset_mode: String(val) }),
                    formatLabel: (val) => `Set preset mode to ${val}`,
                },
                {
                    key: "fan_mode",
                    aliases: ["fan_mode", "fan_modes"],
                    service: "set_fan_mode",
                    buildPayload: (val) => ({ fan_mode: String(val) }),
                    formatLabel: (val) => `Set fan mode to ${val}`,
                },
            ],
            cover: [
                {
                    key: "position",
                    aliases: ["position", "current_position", "pos"],
                    service: "set_cover_position",
                    buildPayload: (val) => {
                        const num = Number(String(val).replace(/%$/, ""));
                        return Number.isNaN(num) ? null : { position: num };
                    },
                    formatLabel: (val) => `Set position to ${String(val).replace(/%$/, "")}%`,
                },
                {
                    key: "tilt_position",
                    aliases: ["tilt_position", "current_tilt_position", "tilt"],
                    service: "set_cover_tilt_position",
                    buildPayload: (val) => {
                        const num = Number(String(val).replace(/%$/, ""));
                        return Number.isNaN(num) ? null : { tilt_position: num };
                    },
                    formatLabel: (val) => `Set tilt position to ${String(val).replace(/%$/, "")}%`,
                },
            ],
            fan: [
                {
                    key: "percentage",
                    aliases: ["percentage", "speed"],
                    service: "set_percentage",
                    buildPayload: (val) => {
                        const num = Number(String(val).replace(/%$/, ""));
                        return Number.isNaN(num) ? null : { percentage: num };
                    },
                    formatLabel: (val) => `Set speed to ${String(val).replace(/%$/, "")}%`,
                },
                {
                    key: "preset_mode",
                    aliases: ["preset_mode", "preset"],
                    service: "set_preset_mode",
                    buildPayload: (val) => ({ preset_mode: String(val) }),
                    formatLabel: (val) => `Set preset mode to ${val}`,
                },
            ],
            media_player: [
                {
                    key: "volume_level",
                    aliases: ["volume_level", "volume", "vol"],
                    service: "volume_set",
                    buildPayload: (val) => {
                        const rawStr = String(val);
                        const num = Number(rawStr.replace(/%$/, ""));
                        if (Number.isNaN(num)) return null;
                        const level = num > 1 || rawStr.endsWith("%") ? Number((num / 100).toFixed(2)) : num;
                        return { volume_level: level };
                    },
                    formatLabel: (val) => `Set volume to ${val}`,
                },
                {
                    key: "source",
                    aliases: ["source", "input_source"],
                    service: "select_source",
                    buildPayload: (val) => ({ source: String(val) }),
                    formatLabel: (val) => `Select source ${val}`,
                },
            ],
            input_number: [
                {
                    key: "value",
                    aliases: ["value", "val"],
                    service: "set_value",
                    buildPayload: (val) => {
                        const num = Number(val);
                        return Number.isNaN(num) ? null : { value: num };
                    },
                    formatLabel: (val) => `Set value to ${val}`,
                },
            ],
            number: [
                {
                    key: "value",
                    aliases: ["value", "val"],
                    service: "set_value",
                    buildPayload: (val) => {
                        const num = Number(val);
                        return Number.isNaN(num) ? null : { value: num };
                    },
                    formatLabel: (val) => `Set value to ${val}`,
                },
            ],
            input_select: [
                {
                    key: "option",
                    aliases: ["option", "options", "select"],
                    service: "select_option",
                    buildPayload: (val) => ({ option: String(val) }),
                    formatLabel: (val) => `Select option ${val}`,
                },
            ],
            select: [
                {
                    key: "option",
                    aliases: ["option", "options", "select"],
                    service: "select_option",
                    buildPayload: (val) => ({ option: String(val) }),
                    formatLabel: (val) => `Select option ${val}`,
                },
            ],
        };
        return specs[domain] || [];
    }

    static _getAttributeListingActions(entity, domain) {
        const attrs = entity.attributes || {};
        const ignoredKeys = new Set([
            "friendly_name",
            "icon",
            "supported_features",
            "supported_color_modes",
            "device_class",
            "state_class",
            "unit_of_measurement",
            "entity_picture",
            "assumed_state",
            "attribution",
        ]);

        const defaultAction = this.getDefaultAction(entity);
        const actions = [];

        for (const [key, val] of Object.entries(attrs)) {
            if (ignoredKeys.has(key) || val === undefined || val === null) {
                continue;
            }
            const humanName = this._humanizeKey(key);
            const formattedVal = this._formatCurrentAttributeValue(key, val);
            const id = `${entity.entity_id}!attr:${key}`;
            actions.push({
                id,
                entityId: entity.entity_id,
                domain: defaultAction.domain,
                service: defaultAction.service,
                serviceData: defaultAction.serviceData,
                label: `${humanName} (current: ${formattedVal})`,
                description: `${entity.entity_id} (attribute: ${key})`,
                keywords: [key.toLowerCase(), humanName.toLowerCase(), "attr", "attribute"],
            });
        }

        return actions;
    }

    static _resolveAttributeKeyValueActions(entity, domain, tokens, servicesCatalog) {
        // Parse either ["brightness", "65"] or ["brightness=65"] or ["brightness:65"]
        let keyPart = null;
        let valuePart = null;

        if (tokens.length === 1) {
            const eqMatch = tokens[0].match(/^([a-zA-Z0-9_]+)\s*[=:]\s*(.+)$/);
            if (eqMatch) {
                keyPart = eqMatch[1].toLowerCase();
                valuePart = eqMatch[2].trim();
            }
        } else if (tokens.length >= 2) {
            const firstEq = tokens[0].match(/^([a-zA-Z0-9_]+)\s*[=:]\s*(.*)$/);
            if (firstEq && firstEq[2]) {
                keyPart = firstEq[1].toLowerCase();
                valuePart = [firstEq[2], ...tokens.slice(1)].join(" ").trim();
            } else {
                keyPart = tokens[0].replace(/[=:]$/, "").toLowerCase();
                valuePart = tokens.slice(1).join(" ").trim();
            }
        }

        if (!keyPart || !valuePart) {
            return [];
        }

        const actions = [];
        const specs = this._getAttributeSpecs(domain);

        for (const spec of specs) {
            const matchesSpec = spec.aliases.some(
                (alias) => alias.startsWith(keyPart) || alias.includes(keyPart)
            );
            if (matchesSpec) {
                const payload = spec.buildPayload(valuePart);
                if (payload) {
                    actions.push(
                        this.createAction(
                            entity,
                            domain,
                            spec.service,
                            spec.formatLabel(valuePart),
                            payload,
                            [spec.key, ...spec.aliases, valuePart]
                        )
                    );
                }
            }
        }

        // Dynamic /api/services field matching for any domain or service field
        const domainServices = servicesCatalog?.[domain];
        if (domainServices) {
            for (const [serviceName, serviceDef] of Object.entries(domainServices)) {
                const fields = serviceDef?.fields || {};
                for (const fieldName of Object.keys(fields)) {
                    const fieldLower = fieldName.toLowerCase();
                    if (
                        fieldLower.includes(keyPart) ||
                        serviceName.toLowerCase() === keyPart
                    ) {
                        const parsedVal = /^-?\d+(?:\.\d+)?$/.test(valuePart)
                            ? Number(valuePart)
                            : valuePart;
                        const label = `${serviceDef.name || this._humanizeKey(serviceName)}: ${fieldName}=${parsedVal}`;
                        actions.push(
                            this.createAction(
                                entity,
                                domain,
                                serviceName,
                                label,
                                { [fieldName]: parsedVal },
                                [serviceName, fieldLower, String(valuePart)]
                            )
                        );
                    }
                }
            }
        }

        return actions;
    }

    static _resolveShorthandActions(entity, domain, tokens) {
        const actions = [];
        const add = (service, label, extraData = {}, keywords = []) => {
            actions.push(this.createAction(entity, domain, service, label, extraData, keywords));
        };

        const raw = tokens.join(" ").trim();
        const lowerRaw = raw.toLowerCase();

        // Percentage pattern: e.g. "40%"
        const pctMatch = lowerRaw.match(/^(\d{1,3})\s*%$/);
        const pctValue = pctMatch ? Math.min(100, Math.max(0, Number(pctMatch[1]))) : null;

        // Kelvin pattern: e.g. "2700k" or "4000k"
        const kelvinMatch = lowerRaw.match(/^(\d{3,5})\s*k$/);
        const kelvinValue = kelvinMatch ? Number(kelvinMatch[1]) : null;

        // Temperature pattern: e.g. "22c", "21.5c", "72f", or plain number on climate
        const tempMatch = lowerRaw.match(/^(-?\d+(?:\.\d+)?)\s*([cf])?$/);

        switch (domain) {
            case "light": {
                if (pctValue !== null) {
                    add(
                        "turn_on",
                        `Set brightness to ${pctValue}%`,
                        { brightness_pct: pctValue },
                        ["brightness", `${pctValue}%`, String(pctValue)]
                    );
                } else if (/^\d{1,3}$/.test(lowerRaw) && Number(lowerRaw) <= 100) {
                    const val = Number(lowerRaw);
                    add(
                        "turn_on",
                        `Set brightness to ${val}%`,
                        { brightness_pct: val },
                        ["brightness", `${val}%`, String(val)]
                    );
                }
                if (kelvinValue !== null) {
                    add(
                        "turn_on",
                        `Set color temperature to ${kelvinValue}K`,
                        { color_temp_kelvin: kelvinValue },
                        ["kelvin", "color_temp", `${kelvinValue}k`]
                    );
                }
                const commonColors = [
                    "red", "green", "blue", "white", "warmwhite", "yellow",
                    "orange", "purple", "pink", "cyan", "magenta"
                ];
                if (commonColors.includes(lowerRaw)) {
                    add(
                        "turn_on",
                        `Set color to ${lowerRaw}`,
                        { color_name: lowerRaw },
                        ["color", lowerRaw]
                    );
                }
                break;
            }
            case "climate": {
                if (tempMatch) {
                    const num = Number(tempMatch[1]);
                    add(
                        "set_temperature",
                        `Set temperature to ${num}°`,
                        { temperature: num },
                        ["temperature", "temp", lowerRaw]
                    );
                }
                const hvacModes = entity.attributes?.hvac_modes || ["off", "heat", "cool", "auto", "dry", "fan_only", "heat_cool"];
                for (const mode of hvacModes) {
                    if (String(mode).toLowerCase().includes(lowerRaw)) {
                        add(
                            "set_hvac_mode",
                            `Set HVAC mode to ${mode}`,
                            { hvac_mode: mode },
                            ["hvac_mode", "mode", String(mode).toLowerCase()]
                        );
                    }
                }
                break;
            }
            case "cover": {
                if (pctValue !== null) {
                    add(
                        "set_cover_position",
                        `Set position to ${pctValue}%`,
                        { position: pctValue },
                        ["position", `${pctValue}%`, String(pctValue)]
                    );
                } else if (/^\d{1,3}$/.test(lowerRaw) && Number(lowerRaw) <= 100) {
                    const val = Number(lowerRaw);
                    add(
                        "set_cover_position",
                        `Set position to ${val}%`,
                        { position: val },
                        ["position", `${val}%`, String(val)]
                    );
                }
                break;
            }
            case "fan": {
                if (pctValue !== null) {
                    add(
                        "set_percentage",
                        `Set speed to ${pctValue}%`,
                        { percentage: pctValue },
                        ["percentage", "speed", `${pctValue}%`]
                    );
                }
                break;
            }
            case "media_player": {
                if (pctValue !== null) {
                    const vol = Number((pctValue / 100).toFixed(2));
                    add(
                        "volume_set",
                        `Set volume to ${pctValue}%`,
                        { volume_level: vol },
                        ["volume", `${pctValue}%`]
                    );
                }
                break;
            }
            case "input_number":
            case "number": {
                if (/^-?\d+(?:\.\d+)?$/.test(lowerRaw)) {
                    const num = Number(lowerRaw);
                    add(
                        "set_value",
                        `Set value to ${num}`,
                        { value: num },
                        ["value", lowerRaw]
                    );
                }
                break;
            }
        }

        return actions;
    }

    static _getBaseDomainActions(entity, domain, servicesCatalog) {
        const actions = [];
        const add = (service, label, extraData = {}, keywords = []) => {
            actions.push(this.createAction(entity, domain, service, label, extraData, keywords));
        };

        switch (domain) {
            case "light":
            case "switch":
            case "input_boolean":
            case "fan":
                add("turn_on", "Turn On", {}, ["on", "turn_on"]);
                add("turn_off", "Turn Off", {}, ["off", "turn_off"]);
                add("toggle", "Toggle", {}, ["toggle"]);
                break;
            case "cover":
                add("open_cover", "Open", {}, ["open", "open_cover"]);
                add("close_cover", "Close", {}, ["close", "close_cover"]);
                add("stop_cover", "Stop", {}, ["stop", "stop_cover"]);
                add("toggle", "Toggle", {}, ["toggle"]);
                break;
            case "climate":
                add("turn_on", "Turn On", {}, ["on", "turn_on"]);
                add("turn_off", "Turn Off", {}, ["off", "turn_off"]);
                add("toggle", "Toggle", {}, ["toggle"]);
                break;
            case "lock":
                add("lock", "Lock", {}, ["lock"]);
                add("unlock", "Unlock", {}, ["unlock"]);
                break;
            case "media_player":
                add("media_play_pause", "Play / Pause", {}, ["play", "pause"]);
                add("media_stop", "Stop", {}, ["stop"]);
                add("media_next_track", "Next Track", {}, ["next"]);
                add("media_previous_track", "Previous Track", {}, ["prev", "previous"]);
                add("turn_on", "Turn On", {}, ["on"]);
                add("turn_off", "Turn Off", {}, ["off"]);
                add("toggle", "Toggle", {}, ["toggle"]);
                break;
            case "scene":
            case "script":
                add("turn_on", "Activate", {}, ["on", "turn_on", "activate", "run"]);
                break;
            case "button":
            case "input_button":
                add("press", "Press", {}, ["press", "push"]);
                break;
            case "automation":
                add("trigger", "Trigger", {}, ["trigger", "run"]);
                add("turn_on", "Enable", {}, ["on", "enable"]);
                add("turn_off", "Disable", {}, ["off", "disable"]);
                add("toggle", "Toggle", {}, ["toggle"]);
                break;
            default:
                if (!servicesCatalog?.[domain]) {
                    add("turn_on", "Turn On", {}, ["on", "turn_on"]);
                    add("turn_off", "Turn Off", {}, ["off", "turn_off"]);
                    add("toggle", "Toggle", {}, ["toggle"]);
                }
                break;
        }

        // Merge any services discovered from /api/services for this domain
        const domainServices = servicesCatalog?.[domain];
        if (domainServices) {
            const existingServices = new Set(actions.map((a) => a.service));
            for (const [serviceName, serviceDef] of Object.entries(domainServices)) {
                if (!existingServices.has(serviceName)) {
                    const label = serviceDef?.name || this._humanizeKey(serviceName);
                    const fieldKeywords = Object.keys(serviceDef?.fields || {});
                    add(serviceName, label, {}, [serviceName, label, ...fieldKeywords]);
                }
            }
        }

        return actions;
    }
}

export default ActionRegistry;
