import type { AgentType } from "@/lib/db";
import type { AgentDefinition } from "@/lib/agents/base";
import { configurationAgent } from "@/lib/agents/configuration";
import { unitTestAgent } from "@/lib/agents/unitTest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<AgentType, AgentDefinition<any>> = {
  configuration: configurationAgent,
  unit_test: unitTestAgent,
};

export function getAgentDefinition(type: AgentType) {
  return registry[type];
}

export function listAgentDefinitions() {
  return Object.values(registry);
}
