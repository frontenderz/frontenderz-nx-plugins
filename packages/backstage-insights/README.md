# Backstage Insights for Nx (`@frontenderz/backstage-insights`) [![npm version](https://badge.fury.io/js/%40frontenderz%2Fbackstage-insights.svg)](https://badge.fury.io/js/%40frontenderz%2Fbackstage-insights)

> **Note:** This is an early-stage release. It has been tested on our internal demo repository, but it has not yet been battle-tested in a wide variety of production environments. Please use with care and be sure to report any issues you encounter.

![Nx and Backstage in love on a beach](https://frontenderz.io/hubfs/nx-backstage-on-the-beach.png)
A powerful Nx Plugin that automates the discovery of your monorepo's components and ownership, generating a valid and interconnected software catalog for [Backstage](https://backstage.io).

This tool acts as the essential bridge between the technical, graph-based reality of your Nx workspace and the socio-technical, entity-based model of Backstage.

## The "Why?" - The Problem We Solve

By default, Backstage can register any Git repository as a single entity in its catalog. For a large Nx monorepo where many teams collaborate, this creates a critical visibility gap. Registering the repository only tells you that it *exists*; it reveals nothing about the dozens or hundreds of applications and libraries *inside* it—what they are, who owns them, or how they relate to each other.

This plugin solves that problem.

It treats your Nx workspace as the single source of truth, scanning its project graph to make the implicit architecture of your monorepo explicit for Backstage. It generates a detailed, up-to-date catalog of every component and its owner, giving you a granular, high-fidelity view of your frontend landscape directly in your developer portal.

## Getting Started

Follow these steps to get up and running in minutes.

### Step 1: Install the Plugin

In your Nx workspace, install the package as a development dependency:

```bash
npm install --save-dev @frontenderz/backstage-insights
```

### Step 2: Initialize the Configuration

Run the `init` generator. This is the only setup command you need to run.

```bash
npx nx g @frontenderz/backstage-insights:init
```

This command will intelligently perform several actions:
* Scans your entire workspace to find all unique owner strings in your `project.json` files.
* Creates a default `.backstage-insights/backstage-nx-owners-mapping.yml` file, pre-populated with your existing owners.
* Creates a default `.backstage-insights/insights.config.json` file with our recommended mappings.
* Updates your `nx.json` and root `project.json` to register the plugin and its commands.

### Step 3: Review and Finalize the Owner Mapping

The `init` generator has created a default mapping file for you at `.backstage-insights/backstage-nx-owners-mapping.yml`. This file is the **single source of truth** for defining your teams.

* **Open the file:** `.backstage-insights/backstage-nx-owners-mapping.yml`
* **What to do:** Review each entry. The `backstageOwner` value is critical:
    * This is the name that will be used to **create a `Group` entity** in the generated `ownership.yaml` file.
    * This is also the name that your components will be assigned to.
    * Ensure these names are the official, canonical names you want to use for teams within your Backstage instance. If your Backstage `Group` names are different from your `nxOwner` names, update the `backstageOwner` values accordingly.
    * If you have any team names in here that don't exist as a Group in Backstage, and you import the file with appropriate 
    permissions, it will add these team names.

### Step 4: Generate Your Catalog Files

Once you are satisfied with your owner mapping, you can run the executor to generate your catalog files.

```bash
npx nx generate-backstage-catalog
```

This command will generate two files in the root of your monorepo: `ownership.yaml` and `catalog-info.yaml`.

### Step 5: Configure Backstage to Load the Files

This is the final step. You need to tell your Backstage instance where to find these new, generated files.

#### **Important: Enabling Group Discovery**

The generated `ownership.yaml` file defines your team entities (`kind: Group`) for Backstage. For security reasons, Backstage requires you to explicitly allow `Group` entities to be loaded from a file location.

**You must update your `app-config.yaml` to include a `rules` block for this file:**

```yaml
# in app-config.yaml
catalog:
  locations:
    - type: file
      target: /path/to/your/monorepo/ownership.yaml
      rules:
        - allow: [Group]
    - type: file
      target: /path/to/your/monorepo/catalog-info.yaml
```

> **Warning:** This will create `Group` entities in your Backstage installation. If your organization already manages teams via a different mechanism, you may choose not to add the `ownership.yaml` location.

## How It Works & How to Contribute

This plugin is highly configurable. For details on how to customize the mapping rules, please see the default configuration files generated by the `init` command in the `.backstage-insights/` directory.

We welcome contributions! Please see our main **[`CONTRIBUTING.md`](../../CONTRIBUTING.md)** file for guidelines on how to get started.

## License

This project is licensed under the MIT License. See the **[`LICENSE`](../../LICENSE)** file for details.