import { ExecutorContext } from '@nx/devkit';
import { vol } from 'memfs';
import * as yaml from 'js-yaml';
import generateExecutor from './executor';

// --- Mocks ---

// Mock the fs module to use our in-memory file system
jest.mock('fs', () => require('memfs').fs);

// Mock the parts of Nx Devkit that interact with the real file system.
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockResolvedValue({
    nodes: {
      'app-a': {
        name: 'app-a',
        type: 'app',
        data: { root: 'apps/app-a' },
      },
      'lib-b': {
        name: 'lib-b',
        type: 'lib',
        data: { root: 'libs/lib-b' },
      },
      'lib-c': {
        name: 'lib-c',
        type: 'lib',
        data: { root: 'libs/lib-c' },
      },
    },
    dependencies: {},
  }),
}));

// We also mock child_process for the git provider.
jest.mock('child_process');
const { execSync } = require('child_process');

describe('generateExecutor', () => {
  let context: ExecutorContext;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset the virtual file system and spies before each test.
    vol.reset();
    jest.clearAllMocks();

    context = {
      root: '/root',
      cwd: '/root',
      isVerbose: false,
      projectsConfigurations: { version: 2, projects: {} },
      nxJsonConfiguration: {},
      projectGraph: {
        nodes: {},
        dependencies: {},
      },
    };

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // A helper to set up a valid mock file system for our tests.
  const setupMockFileSystem = () => {
    const mockFs = {
      // FIX: Provide a complete, realistic configuration for the "Happy Path" test.
      './.backstage-insights/insights.config.json': JSON.stringify({
        mappings: {
          apiVersion: { provider: 'static', value: 'backstage.io/v1alpha1' },
          kind: { provider: 'static', value: 'Component' },
          'metadata.name': { provider: 'nxGraph', value: 'name' },
          'spec.type': { provider: 'nxGraph', value: 'type' },
          'spec.lifecycle': { provider: 'static', value: 'production' },
          'spec.owner': { provider: 'projectJson', value: 'owners' },
        },
      }),
      './.backstage-insights/backstage-nx-owners-mapping.yml': yaml.dump([
        { nxOwner: 'team-a', backstageOwner: 'backstage-team-a' },
        { nxOwner: 'team-b', backstageOwner: 'backstage-team-b' },
      ]),
      './apps/app-a/project.json': JSON.stringify({
        name: 'app-a',
        owners: ['team-a'],
      }),
      './libs/lib-b/project.json': JSON.stringify({
        name: 'lib-b',
        owners: ['team-b'],
      }),
      './libs/lib-c/project.json': JSON.stringify({
        name: 'lib-c',
        owners: ['team-c-unmapped'],
      }),
    };
    vol.fromJSON(mockFs, '/root');
  };

  /**
   * Test Scenario 1: The "Happy Path"
   */
  it('should generate catalog and ownership files correctly', async () => {
    setupMockFileSystem();
    (execSync as jest.Mock).mockReturnValue('git@github.com:org/repo.git');

    const result = await generateExecutor({}, context);

    expect(result.success).toBe(true);

    const ownershipFile = require('fs').readFileSync(
      '/root/ownership.yaml',
      'utf-8'
    );
    expect(ownershipFile).toContain('name: backstage-team-a');
    expect(ownershipFile).toContain('name: backstage-team-b');

    const catalogFile = require('fs').readFileSync(
      '/root/catalog-info.yaml',
      'utf-8'
    );
    expect(catalogFile).toContain('name: app-a');
    expect(catalogFile).toContain('owner: backstage-team-a');
    expect(catalogFile).toContain('name: lib-b');
    expect(catalogFile).toContain('owner: backstage-team-b');
  });

  /**
   * Test Scenario 2: The "Validation Test" - Unmapped Owner
   */
  it('should skip a component with an unmapped owner and log a warning', async () => {
    setupMockFileSystem();
    (execSync as jest.Mock).mockReturnValue('git@github.com:org/repo.git');

    await generateExecutor({}, context);

    const catalogFile = require('fs').readFileSync(
      '/root/catalog-info.yaml',
      'utf-8'
    );
    expect(catalogFile).not.toContain('name: lib-c');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Skipping component 'lib-c' because its owner 'team-c-unmapped' is not defined in the mapping file."
      )
    );
  });

  /**
   * Test Scenario 3: The "Validation Test" - Missing Owner
   */
  it('should skip a component with a missing owner field and log a warning', async () => {
    setupMockFileSystem();
    vol.writeFileSync(
      '/root/apps/app-a/project.json',
      JSON.stringify({ name: 'app-a' })
    );

    await generateExecutor({}, context);

    const catalogFile = require('fs').readFileSync(
      '/root/catalog-info.yaml',
      'utf-8'
    );
    expect(catalogFile).not.toContain('name: app-a');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Skipping component 'app-a' because it has no 'owners' field"
      )
    );
  });

  /**
   * Test Scenario 4: The "Failure Test" - Missing Config Files
   */
  it('should fail and log an error if config files are missing', async () => {
    const result = await generateExecutor({}, context);

    expect(result.success).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Please run the initialization generator to create them'
      )
    );
  });
});

