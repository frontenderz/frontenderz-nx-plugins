import { execSync } from 'child_process';
import {
  gitProvider,
  nxGraphProvider,
  projectJsonProvider,
} from './providers';
import { ProviderContext } from './types';
import * as fs from 'fs';
import { ExecutorContext } from '@nx/devkit';

// Mock the external dependencies
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;

describe('providers', () => {
  let mockContext: ProviderContext;

  beforeEach(() => {
    // Reset mocks before each test
    mockExecSync.mockClear();
    mockReadFileSync.mockClear();
    mockExistsSync.mockClear();

    mockExecSync.mockReturnValue('git@github.com:org/repo.git');

    const mockExecutorContext: ExecutorContext = {
      root: '/root',
      projectName: 'test-project',
      cwd: '/root',
      isVerbose: false,
      projectsConfigurations: {
        version: 2,
        projects: {
          storefront: {
            root: 'apps/storefront',
          },
          'shared-ui': {
            root: 'libs/shared-ui',
          },
        },
      },
      nxJsonConfiguration: {},
      projectGraph: {
        nodes: {
          storefront: {
            name: 'storefront',
            type: 'app',
            data: {
              root: 'apps/storefront',
            },
          },
          'shared-ui': {
            name: 'shared-ui',
            type: 'lib',
            data: {
              root: 'libs/shared-ui',
            },
          },
        },
        dependencies: {
          storefront: [
            {
              type: 'static',
              source: 'storefront',
              target: 'npm:react',
            },
            {
              type: 'static',
              source: 'storefront',
              target: 'shared-ui',
            },
          ],
        },
      },
    };

    mockContext = {
      executorContext: mockExecutorContext,
      projectNode: {
        name: 'storefront',
        type: 'app',
        data: {
          root: 'apps/storefront',
        },
      },
      graph: mockExecutorContext.projectGraph,
      gitRepoSlug: 'frontenderz/frontenderz-nx-plugins',
    };
  });

  describe('gitProvider', () => {
    it('should correctly parse an HTTPS URL', () => {
      mockExecSync.mockReturnValue(
        'https://github.com/frontenderz/frontenderz-nx-plugins.git'
      );
      const slug = gitProvider(mockContext);
      expect(slug).toBe('frontenderz/frontenderz-nx-plugins');
    });

    it('should correctly parse an SSH URL', () => {
      mockExecSync.mockReturnValue(
        'git@github.com:frontenderz/frontenderz-nx-plugins.git'
      );
      const slug = gitProvider(mockContext);
      expect(slug).toBe('frontenderz/frontenderz-nx-plugins');
    });

    it('should return a safe default and suppress console error when git command fails', () => {
      // Arrange: Spy on console.error and provide a mock implementation that does nothing.
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
      // eslint-disable-next-line @typescript-eslint/no-empty-function
        .mockImplementation(() => {});

      mockExecSync.mockImplementation(() => {
        throw new Error('git command failed');
      });
      
      // Act
      const slug = gitProvider(mockContext);
      
      // Assert
      expect(slug).toBe('unknown/unknown');
      // Verify that our expected error message was logged (even though we suppressed it)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not determine git remote URL')
      );
      
      // Cleanup: Restore the original console.error implementation
      consoleErrorSpy.mockRestore();
    });
  });

  describe('nxGraphProvider', () => {
    it('should correctly filter and format dependencies', () => {
      const result = nxGraphProvider(
        { provider: 'nxGraph', value: 'dependencies' },
        mockContext
      );
      expect(result).toEqual(['component:shared-ui']);
    });

    it('should return the project type', () => {
      const result = nxGraphProvider(
        { provider: 'nxGraph', value: 'type' },
        mockContext
      );
      expect(result).toBe('app');
    });
  });

  describe('projectJsonProvider', () => {
    it('should return the first owner from an owners array', () => {
      const mockProjectJson = {
        name: 'storefront',
        owners: ['team-a', 'team-b'],
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockProjectJson));

      const owner = projectJsonProvider(
        { provider: 'projectJson', value: 'owners' },
        mockContext
      );
      expect(owner).toBe('team-a');
    });

    it('should return a description property', () => {
      const mockProjectJson = {
        name: 'storefront',
        description: 'The main storefront application.',
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockProjectJson));
      const description = projectJsonProvider(
        { provider: 'projectJson', value: 'description' },
        mockContext
      );
      expect(description).toBe('The main storefront application.');
    });
  });
});

