#!/usr/bin/env node
import fs from "node:fs";

const reportPath = "./reports/cucumber-report.json";
if (!fs.existsSync(reportPath)) {
    console.warn(`No Cucumber JSON report found at ${reportPath}`);
    process.exit(0);
}

const features = JSON.parse(fs.readFileSync(reportPath, "utf8"));

let totalScenarios = 0;
let passedScenarios = 0;
let failedScenarios = 0;
let totalSteps = 0;
let passedSteps = 0;
let failedSteps = 0;
let totalDurationNs = 0;

const rows = [];

for (const feature of features) {
    for (const element of feature.elements || []) {
        if (element.type !== "scenario") continue;
        totalScenarios++;

        let scenarioFailed = false;
        let scenarioDurationNs = 0;
        let stepCount = 0;

        for (const step of element.steps || []) {
            if (step.hidden) continue;
            stepCount++;
            totalSteps++;
            const status = step.result?.status;
            const duration = step.result?.duration || 0;
            scenarioDurationNs += duration;
            totalDurationNs += duration;

            if (status === "passed") {
                passedSteps++;
            } else {
                failedSteps++;
                scenarioFailed = true;
                if (step.result?.error_message) {
                    const line = step.line || element.line || 1;
                    const firstLine = step.result.error_message.split("\n")[0];
                    console.log(
                        `::error file=${feature.uri},line=${line},title=${feature.name} - ${element.name}::${firstLine}`,
                    );
                }
            }
        }

        if (scenarioFailed) {
            failedScenarios++;
        } else {
            passedScenarios++;
        }

        const durationMs = (scenarioDurationNs / 1e6).toFixed(1);
        const badge = scenarioFailed ? "❌ Failed" : "✅ Passed";
        rows.push(
            `| ${badge} | **${feature.name}** | ${element.name} | ${stepCount} | ${durationMs} ms |`,
        );
    }
}

const totalDurationMs = (totalDurationNs / 1e6).toFixed(1);
const overallBadge = failedScenarios === 0 ? "✅ All Passed" : `❌ ${failedScenarios} Failed`;

const markdown = [
    `## 🥒 Cucumber BDD Test Results — ${overallBadge}`,
    "",
    `- **Scenarios:** ${passedScenarios}/${totalScenarios} passed`,
    `- **Steps:** ${passedSteps}/${totalSteps} passed`,
    `- **Duration:** ${totalDurationMs} ms`,
    "",
    "| Status | Feature | Scenario | Steps | Duration |",
    "| :--- | :--- | :--- | :---: | :---: |",
    ...rows,
    "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
    console.log("Wrote BDD test summary to GITHUB_STEP_SUMMARY.");
} else {
    console.log(markdown);
}
