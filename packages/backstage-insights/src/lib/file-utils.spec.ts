import * as fs from 'fs';
import * as path from 'path';
import {
  writeCatalogInfoFile,
  writeOwnershipFile,
} from './file-utils';
import { BackstageComponent } from './types';

// Mock the entire fs module. All calls to fs functions will be intercepted by Jest.
jest.mock('fs');
// Create a specific, typed mock for writeFileSync so we can inspect its calls.
// FIX: Cast to the correct 'jest.Mock' type.
const mockWriteFileSync = fs.writeFileSync as jest.Mock;

describe('file-utils', () => {
  const workspaceRoot = '/root/test-repo';

  beforeEach(() => {
    // Clear any previous mock calls before each test to ensure isolation.
    mockWriteFileSync.mockClear();
  });

  describe('writeOwnershipFile', () => {
    it('should write a valid multi-document YAML for groups', () => {
      // Arrange: Create mock data for the Group entities.
      const mockGroups = [
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Group',
          metadata: { name: 'team-a' },
        },
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Group',
          metadata: { name: 'team-b' },
        },
      ];

      // Act: Call the function we are testing.
      writeOwnershipFile(workspaceRoot, mockGroups);

      // Assert: Verify that our mocked writeFileSync was used correctly.
      // 1. Check that it was called exactly once.
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

      // 2. Check that it was called with the correct file path.
      expect(mockWriteFileSync.mock.calls[0][0]).toBe(
        path.join(workspaceRoot, 'ownership.yaml')
      );

      // 3. Check that the content it was called with is a valid multi-document YAML string.
      const writtenContent = mockWriteFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('kind: Group');
      expect(writtenContent).toContain('name: team-a');
      expect(writtenContent).toContain('---');
      expect(writtenContent).toContain('name: team-b');
    });
  });

  describe('writeCatalogInfoFile', () => {
    it('should write a valid multi-document YAML for components', () => {
      // Arrange: Create mock data for the Component entities.
      const mockComponents: BackstageComponent[] = [
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: { name: 'component-a' },
          spec: { owner: 'team-a', type: 'lib' },
        },
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: { name: 'component-b' },
          spec: { owner: 'team-b', type: 'app' },
        },
      ];

      // Act: Call the function we are testing.
      writeCatalogInfoFile(workspaceRoot, mockComponents);

      // Assert: Verify the mock was used correctly.
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockWriteFileSync.mock.calls[0][0]).toBe(
        path.join(workspaceRoot, 'catalog-info.yaml')
      );
      const writtenContent = mockWriteFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('kind: Component');
      expect(writtenContent).toContain('name: component-a');
      expect(writtenContent).toContain('---');
      expect(writtenContent).toContain('name: component-b');
    });
  });
});

