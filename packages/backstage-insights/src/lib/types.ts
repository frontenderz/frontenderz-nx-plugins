import {
  ExecutorContext,
  ProjectGraph,
  ProjectGraphProjectNode,
  ProjectConfiguration, // Import the base interface
} from '@nx/devkit';

// This file contains all the shared type definitions for the plugin.

// By extending the base ProjectConfiguration, we get type safety for all
// standard properties while also telling TypeScript about our custom 'owners' property.
export interface ProjectConfigurationWithOwners extends ProjectConfiguration {
  owners?: string[];
}

export type ProviderType =
  | 'static'
  | 'nxGraph'
  | 'projectJson'
  | 'git'
  | 'composite';

export interface ValueMapping {
  provider: ProviderType;
  value: string;
}

export interface CompositeMapping {
  provider: 'composite';
  values: ValueMapping[];
  separator: string;
}

export type Mapping = ValueMapping | CompositeMapping;

export interface InsightsConfig {
  mappings: Record<string, Mapping>;
}

export interface BackstageComponent {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    description?: string;
    annotations?: Record<string, string>;
  };
  spec?: {
    type?: 'app' | 'lib';
    lifecycle?: string;
    owner: string;
    dependsOn?: string[];
  };
}

export interface OwnerMapping {
  nxOwner: string;
  backstageOwner: string;
}

// A context object passed to each provider, containing all necessary dependencies.
export interface ProviderContext {
  executorContext: ExecutorContext;
  projectNode: ProjectGraphProjectNode;
  graph: ProjectGraph;
  gitRepoSlug: string; // The resolved git slug
}

