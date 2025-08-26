import {
  ValueMapping,
  CompositeMapping,
  ProviderContext,
} from './types';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ProjectGraphProjectNode } from '@nx/devkit';

// --- Provider Implementations ---

export function staticProvider(mapping: ValueMapping): string {
  return mapping.value;
}

export function nxGraphProvider(
  mapping: ValueMapping,
  { projectNode, graph }: ProviderContext
): string[] | 'app' | 'lib' | string {
  if (mapping.value === 'dependencies') {
    const dependencies = graph.dependencies[projectNode.name] || [];
    return dependencies
      .filter((dep) => !dep.target.startsWith('npm:'))
      .map((dep) => `component:${dep.target}`);
  }

  // Handle explicit root-level properties
  if (mapping.value === 'name') {
    return projectNode.name;
  }
  if (mapping.value === 'type') {
    return projectNode.type;
  }

  // Handle explicit properties inside the 'data' object
  if (mapping.value === 'root') {
    return projectNode.data.root;
  }

  // If we get here, it's an unsupported property. Return a safe default.
  // This makes the function's behavior explicit and satisfies the type checker.
  console.warn(
    `nxGraphProvider: Unsupported property '${mapping.value}' requested.`
  );
  return '';
}

export function projectJsonProvider(
  mapping: ValueMapping,
  { projectNode, executorContext }: ProviderContext
): string | undefined {
  const projectJsonPath = path.join(
    executorContext.root,
    projectNode.data.root,
    'project.json'
  );
  if (fs.existsSync(projectJsonPath)) {
    const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
    const propertyValue = projectJson[mapping.value];

    if (mapping.value === 'owners' && Array.isArray(propertyValue)) {
      return propertyValue[0];
    }
    return propertyValue;
  }
  return undefined;
}

export function gitProvider({ executorContext }: ProviderContext): string {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd: executorContext.root,
    })
      .toString()
      .trim();
    const match = remoteUrl.match(/[\/:]([\w-]+)\/([\w-]+)\.git/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  } catch (e) {
    console.error(
      "Could not determine git remote URL. Is this a git repository with a remote named 'origin'?"
    );
    return 'unknown/unknown';
  }
  return 'unknown/unknown';
}

export async function compositeProvider(
  mapping: CompositeMapping,
  context: ProviderContext
): Promise<string> {
  const resolvedValues = await Promise.all(
    mapping.values.map(async (item) => {
      if (item.provider === 'git') return context.gitRepoSlug;
      if (item.provider === 'nxGraph')
        return nxGraphProvider(item, context);
      return '';
    })
  );
  return resolvedValues.join(mapping.separator);
}

