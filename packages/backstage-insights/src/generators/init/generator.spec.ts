import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, writeJson } from '@nx/devkit';
import * as yaml from 'js-yaml';

import generator from './generator';
import { NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import { ProjectConfigurationWithOwners } from '../../lib/types';

describe('init generator', () => {
  let tree: Tree;

  // beforeEach is a Jest hook that runs before each test ('it' block)
  // This ensures each test starts with a clean, empty workspace.
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  /**
   * Test Scenario 1: The "Happy Path" - A Clean Workspace
   */
  it('should create all required files in a clean workspace', async () => {
    // Arrange: Set up the virtual workspace with mock projects and owners
    // Use our extended interface to correctly type the mock project configuration.
    writeJson<ProjectConfigurationWithOwners>(
      tree,
      'apps/storefront/project.json',
      {
        name: 'storefront',
        root: 'apps/storefront',
        owners: ['team-ecommerce'],
      }
    );
    writeJson<ProjectConfigurationWithOwners>(
      tree,
      'libs/shared-ui/project.json',
      {
        name: 'shared-ui',
        root: 'libs/shared-ui',
        owners: ['team-design-system', 'team-ecommerce'],
      }
    );

    // Act: Run the generator
    await generator(tree);

    // Assert: Verify that all files were created with the correct content
    // 1. Check insights.config.json
    expect(
      tree.exists('.backstage-insights/insights.config.json')
    ).toBeTruthy();

    // 2. Check backstage-nx-owners-mapping.yml
    const ownerMapping = yaml.load(
      tree.read('.backstage-insights/backstage-nx-owners-mapping.yml', 'utf-8')
    );
    expect(ownerMapping).toEqual([
      { nxOwner: 'team-ecommerce', backstageOwner: 'team-ecommerce' },
      { nxOwner: 'team-design-system', backstageOwner: 'team-design-system' },
    ]);

    // 3. Check the root project.json
    const rootProject = readJson<ProjectConfiguration>(tree, 'project.json');
    expect(rootProject.targets['generate-backstage-catalog']).toBeDefined();

    // 4. Check nx.json for the plugin registration
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    const hasPlugin = nxJson.plugins.some(
      (p) =>
        typeof p === 'object' &&
        p.plugin === '@frontenderz/backstage-insights'
    );
    expect(hasPlugin).toBeTruthy();
  });

  /**
   * Test Scenario 2: The "Idempotency Test" - A Pre-Configured Workspace
   */
  it('should not make changes if run a second time', async () => {
    // Arrange: Run the generator once to configure the workspace
    await generator(tree);
    const configAfterFirstRun = tree.read(
      '.backstage-insights/insights.config.json',
      'utf-8'
    );
    const mappingAfterFirstRun = tree.read(
      '.backstage-insights/backstage-nx-owners-mapping.yml',
      'utf-8'
    );
    const rootProjectAfterFirstRun = tree.read('project.json', 'utf-8');
    const nxJsonAfterFirstRun = tree.read('nx.json', 'utf-8');

    // Act: Run the generator a second time
    await generator(tree);

    // Assert: Verify that the files are identical to their state after the first run
    expect(
      tree.read('.backstage-insights/insights.config.json', 'utf-8')
    ).toEqual(configAfterFirstRun);
    expect(
      tree.read('.backstage-insights/backstage-nx-owners-mapping.yml', 'utf-8')
    ).toEqual(mappingAfterFirstRun);
    expect(tree.read('project.json', 'utf-8')).toEqual(
      rootProjectAfterFirstRun
    );
    expect(tree.read('nx.json', 'utf-8')).toEqual(nxJsonAfterFirstRun);
  });

  /**
   * Test Scenario 3: The "Edge Case" - No Owners Defined
   */
  it('should create an empty owner mapping file if no owners are found', async () => {
    // Arrange: Create projects without the 'owners' property
    writeJson<ProjectConfiguration>(tree, 'apps/storefront/project.json', {
      name: 'storefront',
      root: 'apps/storefront',
      // No 'owners' property
    });

    // Act: Run the generator
    await generator(tree);

    // Assert: The mapping file should exist and contain an empty array
    const ownerMapping = yaml.load(
      tree.read('.backstage-insights/backstage-nx-owners-mapping.yml', 'utf-8')
    );
    expect(ownerMapping).toEqual([]);
  });

  /**
   * Test Scenario 4: The "Edge Case" - Pre-existing Root project.json
   */
  it('should add the target to an existing root project.json without overwriting', async () => {
    // Arrange: Create a root project.json with a pre-existing target
    writeJson<ProjectConfiguration>(tree, 'project.json', {
      name: 'workspace',
      root: '.',
      targets: {
        'my-custom-target': {
          executor: 'nx:noop',
        },
      },
    });

    // Act: Run the generator
    await generator(tree);

    // Assert: The project.json should contain both targets
    const rootProject = readJson<ProjectConfiguration>(tree, 'project.json');
    expect(rootProject.targets['my-custom-target']).toBeDefined();
    expect(rootProject.targets['generate-backstage-catalog']).toBeDefined();
  });
});

