/**
 * Parses GNOME Shell search terms into entity filter terms and action tokens triggered by "!".
 */
export class QueryParser {
    /**
     * @param {string[]} terms
     * @returns {{
     *   entityTerms: string[],
     *   hasAction: boolean,
     *   actionTokens: string[],
     *   rawActionQuery: string
     * }}
     */
    static parse(terms = []) {
        const entityTerms = [];
        const actionTokens = [];
        let hasAction = false;
        // TODO lots of if , lets see if can refactor to use statemachine

        for (const rawTerm of terms) {
            if (!rawTerm) continue;

            if (!hasAction) {
                const bangIndex = rawTerm.indexOf("!");
                if (bangIndex === -1) {
                    entityTerms.push(rawTerm.toLowerCase());
                } else {
                    hasAction = true;
                    const beforeBang = rawTerm.slice(0, bangIndex).trim();
                    const afterBang = rawTerm.slice(bangIndex + 1).trim();

                    if (beforeBang) {
                        entityTerms.push(beforeBang.toLowerCase());
                    }
                    if (afterBang) {
                        for (const sub of afterBang.split("!").map((s) => s.trim()).filter(Boolean)) {
                            actionTokens.push(sub);
                        }
                    }
                }
            } else {
                // Already in action section after "!"
                const cleaned = rawTerm.startsWith("!") ? rawTerm.slice(1).trim() : rawTerm.trim();
                if (cleaned) {
                    for (const sub of cleaned.split("!").map((s) => s.trim()).filter(Boolean)) {
                        actionTokens.push(sub);
                    }
                }
            }
        }

        return {
            entityTerms,
            hasAction,
            actionTokens,
            rawActionQuery: actionTokens.join(" ").trim(),
        };
    }

    /**
     * Checks if an entity matches all entity filter terms against entity_id or friendly_name.
     * @param {{entity_id: string, attributes?: {friendly_name?: string}}} entity
     * @param {string[]} entityTerms
     * @returns {boolean}
     */
    static matchesEntity(entity, entityTerms) {
        if (!entityTerms || entityTerms.length === 0) {
            return true;
        }
        const idLower = (entity.entity_id || "").toLowerCase();
        const nameLower = (entity.attributes?.friendly_name || entity.friendly_name || "").toLowerCase();
        return entityTerms.every(
            (term) => idLower.includes(term) || nameLower.includes(term)
        );
    }
}

export default QueryParser;
