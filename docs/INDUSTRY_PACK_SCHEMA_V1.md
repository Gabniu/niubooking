# Industry Pack Schema V1 — Design Contract

## Purpose

An Industry Pack converts the universal Booking kernel into an industry-fluent product without forking the application or changing scheduling invariants.

## Resolution order

```text
platform defaults
  -> pack defaults
  -> pack-version migration
  -> organization-approved overrides
  -> branch-approved overrides
  -> user display preferences
```

Security policy, data classification, invariant, and permission definitions cannot be weakened by tenant overrides.

## Manifest shape

```ts
interface IndustryPackManifest {
  id: string;
  version: string;
  schemaVersion: 1;
  displayName: string;
  supportedLocales: string[];
  terminology: TerminologyMap;
  theme: IndustryTheme;
  navigation: NavigationContribution[];
  dashboards: DashboardDefinition[];
  resourceTypes: ResourceTypeDefinition[];
  serviceTemplates: ServiceTemplate[];
  capabilities: CapabilityDefinition[];
  workflows: WorkflowDefinition[];
  forms: FormDefinition[];
  outcomes: OutcomeDefinition[];
  permissions: PermissionContribution[];
  automations: AutomationRecipe[];
  reports: ReportDefinition[];
  migrations: PackMigration[];
}
```

Runtime modules are referenced through a registry of known identifiers. Packs do not inject arbitrary executable code or component paths from tenant-controlled data.

## Validation requirements

- IDs are stable, namespaced, and unique.
- Every referenced capability, state, form, outcome, widget, and report exists.
- Workflow graphs have valid initial/final states and no forbidden transition.
- Service requirements reference valid universal resource/capability concepts.
- Accent colors meet contrast rules in supported contexts.
- Permission contributions map to known policy operations.
- Pack upgrades provide deterministic migrations for changed stored shapes.
- Organization overrides are schema-validated and diff-audited.
- A pack cannot change global meanings of success, warning, danger, or information.

## Core versus pack examples

| Universal Core | Industry Pack |
|---|---|
| Customer and booking subject | Student, patient, client, vehicle owner |
| Resource and capability | Instructor/licence class, dentist/specialty, stylist/skill |
| Package and ledger | Lesson bundle, treatment plan allowance, beauty package |
| Form and response | Learner profile, consent/medical history, consultation form |
| Outcome record | Lesson competencies, treatment notes, service formula/preferences |
| Workflow state machine | Lesson flow, appointment/treatment flow, salon service flow |

## Acceptance fixtures

V1 schema is not accepted until Driving School, Dental, and Salon fixture manifests all:

- validate;
- render in the shared navigation and dashboard registries;
- define at least one multi-requirement service;
- execute a lifecycle through the same booking APIs;
- store pack-specific outcomes through typed extension fields;
- pass upgrade and invalid-manifest tests.

