import { Tree, readJson, writeJson, NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BackstageComponent } from './types';

// --- Executor File Utils ---

/**
 * Takes an array of Backstage Group entities and writes them to an ownership.yaml file.
 */
export function writeOwnershipFile(
  workspaceRoot: string,
  groupEntities: unknown[]
): void {
  const yamlOutput = groupEntities
    .map((doc) => yaml.dump(doc))
    .join('---\n');
  const outputPath = path.join(workspaceRoot, 'ownership.yaml');
  fs.writeFileSync(outputPath, yamlOutput);
  console.log(`✅ Generated ownership.yaml with ${groupEntities.length} groups.`);
}

/**
 * Takes an array of Backstage Component entities and writes them to a catalog-info.yaml file.
 */
export function writeCatalogInfoFile(
  workspaceRoot: string,
  componentDocs: BackstageComponent[]
): void {
  const yamlOutput = componentDocs
    .map((doc) => yaml.dump(doc))
    .join('---\n');
  const outputPath = path.join(workspaceRoot, 'catalog-info.yaml');
  fs.writeFileSync(outputPath, yamlOutput);
  console.log(
    `✅ Generated catalog-info.yaml with ${componentDocs.length} components.`
  );
}


// --- Generator File Utils ---

/**
 * Updates the nx.json file to register the plugin.
 */
export function addPluginToNxJson(tree: Tree): void {
  const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');

  nxJson.plugins = nxJson.plugins || [];
  if (
    !nxJson.plugins.some((p: string | { plugin: string }) => {
      if (typeof p === 'string') {
        return p === '@frontenderz/backstage-insights';
      }
      return p.plugin === '@frontenderz/backstage-insights';
    })
  ) {
    nxJson.plugins.push({
      plugin: '@frontenderz/backstage-insights',
      options: {},
    });
  }

  writeJson(tree, 'nx.json', nxJson);
}

/**
 * Updates or creates the root project.json to add the executor target.
 */
export function addRootTarget(tree: Tree): void {
  const rootProjectJsonPath = 'project.json';
  let projectConfig: ProjectConfiguration;

  if (tree.exists(rootProjectJsonPath)) {
    projectConfig = readJson<ProjectConfiguration>(tree, rootProjectJsonPath);
  } else {
    projectConfig = {
      name: 'frontenderz-demo-repo', // Or derive from package.json
      root: '.',
    };
  }

  projectConfig.targets = projectConfig.targets || {};
  if (!projectConfig.targets['generate-backstage-catalog']) {
    projectConfig.targets['generate-backstage-catalog'] = {
      executor: '@frontenderz/backstage-insights:generate',
      options: {},
    };
  }

  writeJson(tree, rootProjectJsonPath, projectConfig);
}

