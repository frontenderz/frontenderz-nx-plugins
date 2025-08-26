import {
  Tree,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
import * as yaml from 'js-yaml';
import { ProjectConfigurationWithOwners } from '../../lib/types';
import { addPluginToNxJson, addRootTarget } from '../../lib/file-utils';

// Main generator function
export default async function (tree: Tree) {
  console.log('Initializing Backstage Insights...');

  // 1. Scan the workspace for all unique owners
  const projects = getProjects(tree);
  const allOwners = new Set<string>();

  for (const [projectName] of projects.entries()) {
    try {
      const projectConfig = readJson<ProjectConfigurationWithOwners>(
        tree,
        joinPathFragments(
          readProjectConfiguration(tree, projectName).root,
          'project.json'
        )
      );

      // Backstage doesn't support multiple owners, so we just take the first one
      if (projectConfig.owners && Array.isArray(projectConfig.owners)) {
        projectConfig.owners.forEach((owner) => allOwners.add(owner));
      }
    } catch (e) {
      console.warn(`Could not read project configuration for ${projectName}.`);
    }
  }

  // 2. Copy the template files into the user's workspace
  generateFiles(
    tree,
    joinPathFragments(__dirname, './files'),
    '.',
    {}
  );

  // 3. Rename the config file template
  tree.rename(
    '.backstage-insights/insights.config.json__tmpl__',
    '.backstage-insights/insights.config.json'
  );

  // 4. Populate the owners mapping file with discovered owners
  const ownerMapping = Array.from(allOwners).map((owner) => ({
    nxOwner: owner,
    backstageOwner: owner,
  }));

  const ownerMappingYaml = yaml.dump(ownerMapping);
  tree.write(
    '.backstage-insights/backstage-nx-owners-mapping.yml',
    `# This file maps the owner strings found in your Nx project.json files
# to the official Group entity names used in your Backstage instance.
# Please review and update the 'backstageOwner' values to match your organization.
${ownerMappingYaml}`
  );

  // 5. Update nx.json to register our plugin
  addPluginToNxJson(tree);

  // 6. Update (or create) the root project.json to add our executor target
  addRootTarget(tree);

  // 7. Format all the files we've changed
  await formatFiles(tree);

  // 8. Return a callback that runs after the changes are written to disk
  return () => {
    console.log(
      `✅ Backstage Insights initialized. Please review the generated files in the '.backstage-insights' directory.`
    );
  };
}

