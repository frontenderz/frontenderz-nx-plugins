import { ExecutorContext, createProjectGraphAsync } from '@nx/devkit';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { set } from 'lodash';
import {
  BackstageComponent,
  InsightsConfig,
  OwnerMapping,
  ValueMapping,
  CompositeMapping,
  ProviderContext,
} from '../../lib/types';
import {
  staticProvider,
  nxGraphProvider,
  projectJsonProvider,
  gitProvider,
  compositeProvider,
} from '../../lib/providers';
import { writeOwnershipFile, writeCatalogInfoFile } from '../../lib/file-utils';

export default async function generateExecutor(
  options: { configPath?: string },
  executorContext: ExecutorContext
): Promise<{ success: boolean }> {
  console.log('Running Backstage Insights catalog generator...');
  const workspaceRoot = executorContext.root;

  // --- Configuration and Mapping File Loading ---
  const configSearchPaths = [
    options.configPath,
    path.join(workspaceRoot, '.backstage-insights/insights.config.json'),
    path.join(workspaceRoot, 'insights.config.json'),
  ].filter(Boolean);

  const ownerMappingSearchPaths = [
    path.join(
      workspaceRoot,
      '.backstage-insights/backstage-nx-owners-mapping.yml'
    ),
  ];

  const configPath = configSearchPaths.find((p) => fs.existsSync(p));
  const ownerMappingPath = ownerMappingSearchPaths.find((p) =>
    fs.existsSync(p)
  );

  if (!configPath || !ownerMappingPath) {
    console.error('❌ Error: Configuration files are missing.');
    if (!configPath) console.error('Could not find insights.config.json.');
    if (!ownerMappingPath)
      console.error('Could not find backstage-nx-owners-mapping.yml.');
    console.error(
      '\nPlease run the initialization generator to create them: npx nx g @frontenderz/backstage-insights:init'
    );
    return { success: false };
  }

  const config: InsightsConfig = JSON.parse(
    fs.readFileSync(configPath, 'utf-8')
  );
  const ownerMappings: OwnerMapping[] = yaml.load(
    fs.readFileSync(ownerMappingPath, 'utf-8')
  ) as OwnerMapping[];
  const ownerMap = new Map(
    ownerMappings.map((m) => [m.nxOwner, m.backstageOwner])
  );

  // --- Data Composition Logic ---

  // 1. Compose Group Entities from the mapping file
  const uniqueBackstageOwners = new Set(
    ownerMappings.map((m) => m.backstageOwner)
  );
  const groupEntities = [];
  for (const ownerName of uniqueBackstageOwners) {
    groupEntities.push({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        name: ownerName,
        description: `The ${ownerName} team`,
      },
      spec: {
        type: 'team',
        children: [],
      },
    });
  }

  // 2. Compose Component Entities from the Nx graph
  const graph = await createProjectGraphAsync();

  // FIX: Create a context object that satisfies the gitProvider's signature.
  // Since it only needs executorContext, we can provide dummy/empty values for the rest.
  const gitProviderContext: ProviderContext = {
    executorContext,
    projectNode: null, // Not used by gitProvider
    graph: null,       // Not used by gitProvider
    gitRepoSlug: '',   // Not used by gitProvider
  };
  const gitRepoSlug = gitProvider(gitProviderContext);

  const componentDocs: BackstageComponent[] = [];
  let skippedCount = 0;

  for (const projectName in graph.nodes) {
    const projectNode = graph.nodes[projectName];
    if (projectNode.type !== 'app' && projectNode.type !== 'lib') continue;

    const providerContext: ProviderContext = {
      executorContext,
      projectNode,
      graph,
      gitRepoSlug,
    };

    const nxOwner = projectJsonProvider(
      { provider: 'projectJson', value: 'owners' },
      providerContext
    );

    if (!nxOwner) {
      console.warn(
        `⚠️ Skipping component '${projectName}' because it has no 'owners' field in its project.json.`
      );
      skippedCount++;
      continue;
    }

    const backstageOwner = ownerMap.get(nxOwner);
    if (!backstageOwner) {
      console.warn(
        `❌ Skipping component '${projectName}' because its owner '${nxOwner}' is not defined in the mapping file.`
      );
      skippedCount++;
      continue;
    }

    const doc: BackstageComponent = { spec: { owner: backstageOwner } };

    for (const keyPath in config.mappings) {
      const mapping = config.mappings[keyPath];
      let value;

      switch (mapping.provider) {
        case 'static':
          value = staticProvider(mapping as ValueMapping);
          break;
        case 'nxGraph':
          value = nxGraphProvider(mapping as ValueMapping, providerContext);
          break;
        case 'projectJson':
          if (keyPath === 'spec.owner') {
            value = backstageOwner;
          } else {
            value = projectJsonProvider(
              mapping as ValueMapping,
              providerContext
            );
          }
          break;
        case 'git':
          value = gitRepoSlug; // Use the cached value
          break;
        case 'composite':
          value = await compositeProvider(
            mapping as CompositeMapping,
            providerContext
          );
          break;
      }

      if (value !== undefined) {
        set(doc, keyPath, value);
      }
    }
    componentDocs.push(doc);
  }

  // --- File Writing Logic ---
  // Pass the composed data structures to our file utilities.
  writeOwnershipFile(workspaceRoot, groupEntities);
  writeCatalogInfoFile(workspaceRoot, componentDocs);

  if (skippedCount > 0) {
    console.log(
      `ℹ️  Skipped ${skippedCount} components due to missing or invalid ownership.`
    );
  }

  return { success: true };
}

