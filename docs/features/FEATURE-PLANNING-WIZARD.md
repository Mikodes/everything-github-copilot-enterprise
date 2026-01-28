# Feature Planning Wizard

> **Estado**: Propuesta de Feature
> **Prioridad**: Alta
> **Versión objetivo**: 1.1.0
> **Fecha**: 2026-01-28

---

## 1. Visión General

### 1.1 Problema

Los equipos de desarrollo enterprise enfrentan estos desafíos al planificar nuevas funcionalidades:

```
PROBLEMAS EN LA PLANIFICACIÓN DE FEATURES
├── Contexto Incompleto
│   ├── El PM describe la feature sin conocer la arquitectura
│   ├── Los devs no entienden el "por qué" del negocio
│   └── Se pierden requisitos no funcionales
├── Estimaciones Imprecisas
│   ├── Sin visibilidad del impacto en otros módulos
│   ├── Dependencias no identificadas
│   └── Tech debt no considerada
├── Backlog Fragmentado
│   ├── Tareas demasiado grandes o pequeñas
│   ├── Sin estructura clara de implementación
│   └── Criterios de aceptación ambiguos
└── Desconexión con el Código
    ├── No se sabe qué archivos modificar
    ├── Patterns a seguir no documentados
    └── ADRs relevantes ignorados
```

### 1.2 Solución Propuesta

**Feature Planning Wizard**: Un sistema guiado que:

1. **Guía al usuario** a través de un formulario estructurado
2. **Analiza el contexto** del proyecto (Memory Bank + código)
3. **Genera un backlog** detallado y estructurado
4. **Visualiza el plan** con dependencias y timeline
5. **Integra con herramientas** (GitHub Issues, Jira, Azure DevOps)

---

## 2. User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FEATURE PLANNING WIZARD FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   STEP 1     │    │   STEP 2     │    │   STEP 3     │    │   STEP 4     │
│  Descripción │ →  │  Contexto    │ →  │  Refinamiento│ →  │  Generación  │
│  de Feature  │    │  Técnico     │    │  con IA      │    │  de Backlog  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ • Título     │    │ • Módulo     │    │ • Chat con   │    │ • Épicas     │
│ • Problema   │    │ • Impacto    │    │   Copilot    │    │ • Stories    │
│ • Solución   │    │ • NFRs       │    │ • Preguntas  │    │ • Tasks      │
│ • Usuarios   │    │ • Riesgos    │    │   clarific.  │    │ • Subtasks   │
│ • Valor      │    │ • Deps       │    │ • Sugerencias│    │ • ACs        │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                  │
                                                                  ▼
                                              ┌──────────────────────────────┐
                                              │         STEP 5               │
                                              │   Visualización y Export     │
                                              │                              │
                                              │ • Vista Kanban               │
                                              │ • Vista Timeline             │
                                              │ • Dependency Graph           │
                                              │ • Export a GitHub/Jira       │
                                              └──────────────────────────────┘
```

---

## 3. Especificación del Formulario

### 3.1 Step 1: Descripción de la Feature

```yaml
step: 1
title: "Describe tu Feature"
description: "Cuéntanos qué quieres construir"

fields:
  - name: featureTitle
    type: text
    label: "Título de la Feature"
    placeholder: "Ej: Sistema de notificaciones push"
    required: true
    maxLength: 100
    helpText: "Un título corto y descriptivo"

  - name: problemStatement
    type: textarea
    label: "¿Qué problema resuelve?"
    placeholder: |
      Describe el problema actual que tienen los usuarios.
      Ej: Los usuarios no se enteran de actualizaciones importantes
      hasta que entran a la app manualmente...
    required: true
    minLength: 50
    helpText: "Enfócate en el problema, no en la solución"
    aiAssist: true  # Botón "Mejorar con IA"

  - name: proposedSolution
    type: textarea
    label: "Solución propuesta"
    placeholder: |
      Describe a alto nivel cómo quieres resolver el problema.
      Ej: Implementar un sistema de notificaciones push que
      alerte a los usuarios sobre...
    required: true
    aiAssist: true

  - name: targetUsers
    type: multiselect
    label: "¿Quién usará esta feature?"
    options:
      - value: end_users
        label: "Usuarios finales"
      - value: admins
        label: "Administradores"
      - value: developers
        label: "Desarrolladores (API)"
      - value: external_systems
        label: "Sistemas externos"
    required: true

  - name: businessValue
    type: select
    label: "Valor de negocio"
    options:
      - value: critical
        label: "🔴 Crítico - Sin esto no podemos operar"
      - value: high
        label: "🟠 Alto - Impacto significativo en revenue/retención"
      - value: medium
        label: "🟡 Medio - Mejora importante pero no urgente"
      - value: low
        label: "🟢 Bajo - Nice to have"
    required: true

  - name: successMetrics
    type: textarea
    label: "¿Cómo mediremos el éxito?"
    placeholder: |
      Ej:
      - 80% de usuarios con notificaciones habilitadas
      - Reducción del 50% en tiempo de respuesta a eventos
      - NPS de la feature > 8
    required: false
    aiAssist: true
```

### 3.2 Step 2: Contexto Técnico

```yaml
step: 2
title: "Contexto Técnico"
description: "Ayúdanos a entender el impacto técnico"

# Auto-populated from Memory Bank
autofill:
  - source: memory-bank://modules
    field: affectedModules
  - source: memory-bank://team/context
    field: teamOwner

fields:
  - name: affectedModules
    type: multiselect
    label: "Módulos afectados"
    options: "dynamic:memory-bank://modules"  # Cargado del Memory Bank
    required: true
    helpText: "Selecciona todos los módulos que se verán afectados"

  - name: primaryModule
    type: select
    label: "Módulo principal"
    options: "dynamic:selected:affectedModules"
    required: true
    helpText: "¿Dónde vivirá la mayor parte del código nuevo?"

  - name: teamOwner
    type: select
    label: "Equipo responsable"
    options: "dynamic:memory-bank://team/members"
    required: true

  - name: technicalApproach
    type: textarea
    label: "Enfoque técnico (opcional)"
    placeholder: |
      Si tienes ideas sobre cómo implementarlo técnicamente...
      Ej: Usar Firebase Cloud Messaging, crear un nuevo servicio
      de notificaciones, integrar con el event bus existente...
    required: false
    aiAssist: true
    aiPrompt: "Sugiere enfoques técnicos basado en el Memory Bank y la arquitectura del proyecto"

  - name: nonFunctionalRequirements
    type: checklist
    label: "Requisitos No Funcionales"
    options:
      - value: performance
        label: "⚡ Performance - Latencia < X ms"
        hasInput: true
        inputLabel: "Latencia máxima (ms)"
      - value: scalability
        label: "📈 Escalabilidad - Soportar X usuarios/requests"
        hasInput: true
        inputLabel: "Carga esperada"
      - value: security
        label: "🔒 Seguridad - Autenticación/Autorización especial"
        hasInput: true
        inputLabel: "Requisitos de seguridad"
      - value: availability
        label: "🟢 Disponibilidad - SLA X%"
        hasInput: true
        inputLabel: "SLA requerido"
      - value: compliance
        label: "📋 Compliance - GDPR, HIPAA, etc"
        hasInput: true
        inputLabel: "Normativas aplicables"
      - value: accessibility
        label: "♿ Accesibilidad - WCAG nivel"
        hasInput: true
        inputLabel: "Nivel WCAG"

  - name: integrations
    type: multiselect
    label: "Integraciones externas"
    options:
      - value: database_new
        label: "Nueva base de datos"
      - value: external_api
        label: "API externa"
      - value: message_queue
        label: "Cola de mensajes"
      - value: cache
        label: "Sistema de caché"
      - value: search
        label: "Motor de búsqueda"
      - value: storage
        label: "Almacenamiento de archivos"
      - value: notification
        label: "Servicio de notificaciones"
      - value: analytics
        label: "Analytics/Tracking"
      - value: payment
        label: "Pasarela de pago"
    allowOther: true

  - name: knownRisks
    type: textarea
    label: "Riesgos conocidos"
    placeholder: |
      ¿Hay algo que te preocupe de esta implementación?
      Ej: Dependencia de servicio externo, cambios en esquema de BD,
      posible impacto en performance...
    required: false
    aiAssist: true
    aiPrompt: "Identifica riesgos potenciales basado en el contexto del proyecto"

  - name: existingCode
    type: file_picker
    label: "Código relacionado (opcional)"
    multiple: true
    helpText: "Selecciona archivos que sirvan de referencia o que se modificarán"
```

### 3.3 Step 3: Refinamiento con IA

```yaml
step: 3
title: "Refinamiento con Copilot"
description: "Copilot analiza tu feature y hace preguntas de clarificación"

mode: conversational
aiAgent: feature-planner

systemPrompt: |
  Eres un Product Manager y Tech Lead experto que ayuda a refinar
  features antes de planificar.

  Tu trabajo es:
  1. Analizar la feature propuesta
  2. Hacer preguntas de clarificación importantes
  3. Identificar gaps en los requisitos
  4. Sugerir mejoras o alternativas
  5. Validar contra el contexto técnico del proyecto

  Contexto del proyecto:
  {memory_bank_context}

  ADRs relevantes:
  {related_adrs}

  Patterns del equipo:
  {team_patterns}

suggestedQuestions:
  - category: "Funcionalidad"
    questions:
      - "¿Qué pasa si {edge_case}?"
      - "¿Cómo se comporta en modo offline?"
      - "¿Necesita funcionar en todos los dispositivos/navegadores?"

  - category: "Datos"
    questions:
      - "¿Qué datos nuevos necesitamos almacenar?"
      - "¿Hay datos existentes que podemos reutilizar?"
      - "¿Cuánto tiempo debemos retener estos datos?"

  - category: "Seguridad"
    questions:
      - "¿Quién puede acceder a esta funcionalidad?"
      - "¿Hay datos sensibles involucrados?"
      - "¿Necesita auditoría de acciones?"

  - category: "Integraciones"
    questions:
      - "¿Cómo afecta esto a la API pública?"
      - "¿Necesitamos notificar a consumidores de la API?"
      - "¿Hay webhooks o eventos que debamos emitir?"

outputFormat:
  refinedRequirements: string
  clarifications: array
  suggestions: array
  risks: array
  dependencies: array
```

### 3.4 Step 4: Generación de Backlog

```yaml
step: 4
title: "Backlog Generado"
description: "Copilot genera el backlog detallado"

aiAgent: backlog-generator

systemPrompt: |
  Genera un backlog detallado para la feature descrita.

  REGLAS:
  1. Crear épicas para grupos de funcionalidad relacionada
  2. Cada épica tiene user stories
  3. Cada story tiene tasks técnicas
  4. Cada task puede tener subtasks
  5. Incluir acceptance criteria específicos y testeables
  6. Estimar en story points (fibonacci: 1,2,3,5,8,13)
  7. Identificar dependencias entre items
  8. Sugerir orden de implementación

  CONTEXTO:
  - Módulo principal: {primary_module}
  - Arquitectura: {architecture_from_memory_bank}
  - Patterns a seguir: {team_patterns}
  - Tech stack: {tech_stack}

outputSchema:
  type: object
  properties:
    summary:
      type: object
      properties:
        totalEpics: number
        totalStories: number
        totalTasks: number
        estimatedPoints: number
        suggestedSprints: number

    epics:
      type: array
      items:
        type: object
        properties:
          id: string
          title: string
          description: string
          priority: enum[critical, high, medium, low]
          estimatedPoints: number
          stories:
            type: array
            items:
              type: object
              properties:
                id: string
                title: string
                description: string
                asA: string      # As a [user type]
                iWant: string    # I want [action]
                soThat: string   # So that [benefit]
                acceptanceCriteria:
                  type: array
                  items:
                    type: object
                    properties:
                      given: string
                      when: string
                      then: string
                estimatedPoints: number
                suggestedAssignee: string
                dependencies: array[string]  # IDs de otras stories
                tasks:
                  type: array
                  items:
                    type: object
                    properties:
                      id: string
                      title: string
                      type: enum[backend, frontend, database, infrastructure, testing, documentation]
                      description: string
                      filesToModify: array[string]
                      filesToCreate: array[string]
                      technicalNotes: string
                      estimatedHours: number
                      subtasks: array[string]

    implementationOrder:
      type: array
      items:
        type: object
        properties:
          phase: number
          name: string
          items: array[string]  # IDs de épicas/stories
          rationale: string

    risks:
      type: array
      items:
        type: object
        properties:
          description: string
          probability: enum[high, medium, low]
          impact: enum[high, medium, low]
          mitigation: string

    technicalDebt:
      type: array
      items:
        type: object
        properties:
          description: string
          recommendation: string
          relatedADR: string
```

### 3.5 Step 5: Visualización y Export

```yaml
step: 5
title: "Visualiza y Exporta"
description: "Revisa el backlog generado y expórtalo"

views:
  - name: kanban
    title: "Vista Kanban"
    columns:
      - "Backlog"
      - "Ready"
      - "In Progress"
      - "Review"
      - "Done"
    groupBy: epic
    showEstimates: true

  - name: timeline
    title: "Timeline"
    type: gantt
    showDependencies: true
    showMilestones: true
    groupBy: phase

  - name: dependencies
    title: "Grafo de Dependencias"
    type: graph
    nodes: stories
    edges: dependencies
    highlightCriticalPath: true

  - name: tree
    title: "Vista Jerárquica"
    type: tree
    structure: epic > story > task > subtask
    expandable: true

  - name: table
    title: "Vista Tabla"
    type: table
    columns:
      - id
      - title
      - type
      - estimate
      - assignee
      - dependencies
      - status
    sortable: true
    filterable: true

actions:
  - name: export_github
    title: "Exportar a GitHub Issues"
    icon: github
    options:
      - createMilestone: boolean
      - createLabels: boolean
      - assignTeam: boolean
      - linkDependencies: boolean

  - name: export_jira
    title: "Exportar a Jira"
    icon: jira
    options:
      - projectKey: string
      - createEpics: boolean
      - createSprints: boolean

  - name: export_azure
    title: "Exportar a Azure DevOps"
    icon: azure
    options:
      - organization: string
      - project: string
      - areaPath: string

  - name: export_markdown
    title: "Exportar a Markdown"
    icon: markdown
    template: backlog-template.md

  - name: export_json
    title: "Exportar JSON"
    icon: json

  - name: save_memory_bank
    title: "Guardar en Memory Bank"
    icon: save
    destination: ".memory-bank/planning/{feature-slug}/"
```

---

## 4. Arquitectura Técnica

### 4.1 Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FEATURE PLANNING WIZARD ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER                                        │
├───────────────────┬───────────────────┬─────────────────────────────────────┤
│   VS Code         │   Web Dashboard   │   CLI                               │
│   Extension       │   (Next.js)       │   (egce plan)                       │
│                   │                   │                                     │
│ • Webview Panel   │ • /plan route     │ • Interactive prompts               │
│ • Wizard UI       │ • Full wizard     │ • JSON output                       │
│ • Quick actions   │ • Visualization   │ • Pipe to tools                     │
└─────────┬─────────┴─────────┬─────────┴─────────────────┬───────────────────┘
          │                   │                           │
          └───────────────────┴───────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Planning        │  │ Context         │  │ Export          │             │
│  │ Service         │  │ Enrichment      │  │ Service         │             │
│  │                 │  │                 │  │                 │             │
│  │ • Wizard state  │  │ • Load MB       │  │ • GitHub API    │             │
│  │ • Validation    │  │ • Find ADRs     │  │ • Jira API      │             │
│  │ • Persistence   │  │ • Get patterns  │  │ • Azure API     │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                                ▼                                            │
│                    ┌─────────────────────┐                                  │
│                    │   AI Generation     │                                  │
│                    │   Service           │                                  │
│                    │                     │                                  │
│                    │ • Copilot API       │                                  │
│                    │ • Prompt templates  │                                  │
│                    │ • Output parsing    │                                  │
│                    └─────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
├───────────────────┬───────────────────┬─────────────────────────────────────┤
│   Memory Bank     │   Planning Store  │   Export Configs                    │
│                   │                   │                                     │
│ • Project context │ • Draft plans     │ • GitHub tokens                     │
│ • Module contexts │ • Generated       │ • Jira configs                      │
│ • ADRs            │   backlogs        │ • Azure configs                     │
│ • Patterns        │ • History         │                                     │
└───────────────────┴───────────────────┴─────────────────────────────────────┘
```

### 4.2 VS Code Extension - Webview Implementation

```typescript
// tools/vscode-extension/src/planning/PlanningWizardPanel.ts
import * as vscode from 'vscode';
import { MemoryBankService } from '../services/MemoryBankService';
import { AIGenerationService } from '../services/AIGenerationService';

interface WizardState {
  currentStep: number;
  data: {
    step1: FeatureDescription | null;
    step2: TechnicalContext | null;
    step3: RefinementResult | null;
    step4: GeneratedBacklog | null;
  };
  isGenerating: boolean;
  errors: string[];
}

export class PlanningWizardPanel {
  public static currentPanel: PlanningWizardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _state: WizardState;
  private readonly _memoryBank: MemoryBankService;
  private readonly _aiService: AIGenerationService;

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PlanningWizardPanel.currentPanel) {
      PlanningWizardPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'featurePlanningWizard',
      'Feature Planning Wizard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'node_modules'),
        ],
      }
    );

    PlanningWizardPanel.currentPanel = new PlanningWizardPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._memoryBank = new MemoryBankService();
    this._aiService = new AIGenerationService();

    this._state = {
      currentStep: 1,
      data: { step1: null, step2: null, step3: null, step4: null },
      isGenerating: false,
      errors: [],
    };

    this._panel.webview.html = this._getHtmlForWebview();
    this._setupMessageHandlers();
    this._loadInitialContext();
  }

  private _setupMessageHandlers() {
    this._panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'nextStep':
          await this._handleNextStep(message.data);
          break;
        case 'previousStep':
          this._handlePreviousStep();
          break;
        case 'aiAssist':
          await this._handleAIAssist(message.field, message.currentValue);
          break;
        case 'generateBacklog':
          await this._handleGenerateBacklog();
          break;
        case 'export':
          await this._handleExport(message.target, message.options);
          break;
        case 'saveToMemoryBank':
          await this._handleSaveToMemoryBank();
          break;
      }
    });
  }

  private async _loadInitialContext() {
    // Load modules from Memory Bank
    const modules = await this._memoryBank.getModules();
    const team = await this._memoryBank.getTeamContext();
    const patterns = await this._memoryBank.getPatterns();

    this._postMessage({
      type: 'contextLoaded',
      data: { modules, team, patterns },
    });
  }

  private async _handleNextStep(stepData: unknown) {
    const step = this._state.currentStep;

    // Validate step data
    const validation = this._validateStepData(step, stepData);
    if (!validation.valid) {
      this._postMessage({ type: 'validationError', errors: validation.errors });
      return;
    }

    // Save step data
    this._state.data[`step${step}` as keyof typeof this._state.data] = stepData;

    // If moving to step 3, prepare AI context
    if (step === 2) {
      await this._prepareRefinementContext();
    }

    // If moving to step 4, generate backlog
    if (step === 3) {
      await this._handleGenerateBacklog();
    }

    this._state.currentStep = Math.min(step + 1, 5);
    this._updateWebview();
  }

  private async _handleAIAssist(field: string, currentValue: string) {
    this._postMessage({ type: 'aiAssistStarted', field });

    try {
      const context = await this._memoryBank.getProjectContext();
      const improved = await this._aiService.improveText(field, currentValue, context);

      this._postMessage({
        type: 'aiAssistComplete',
        field,
        suggestion: improved,
      });
    } catch (error) {
      this._postMessage({
        type: 'aiAssistError',
        field,
        error: (error as Error).message,
      });
    }
  }

  private async _handleGenerateBacklog() {
    this._state.isGenerating = true;
    this._updateWebview();

    try {
      const { step1, step2, step3 } = this._state.data;

      // Gather all context
      const projectContext = await this._memoryBank.getProjectContext();
      const moduleContext = step2?.primaryModule
        ? await this._memoryBank.getModuleContext(step2.primaryModule)
        : null;
      const relatedADRs = await this._memoryBank.findRelatedADRs(
        step2?.affectedModules || []
      );
      const patterns = await this._memoryBank.getPatterns();

      // Generate backlog with AI
      const backlog = await this._aiService.generateBacklog({
        feature: step1,
        technicalContext: step2,
        refinement: step3,
        projectContext,
        moduleContext,
        relatedADRs,
        patterns,
      });

      this._state.data.step4 = backlog;
      this._state.isGenerating = false;
      this._state.currentStep = 4;
      this._updateWebview();

    } catch (error) {
      this._state.isGenerating = false;
      this._state.errors.push((error as Error).message);
      this._updateWebview();
    }
  }

  private async _handleExport(
    target: 'github' | 'jira' | 'azure' | 'markdown' | 'json',
    options: Record<string, unknown>
  ) {
    const backlog = this._state.data.step4;
    if (!backlog) return;

    try {
      switch (target) {
        case 'github':
          await this._exportToGitHub(backlog, options);
          break;
        case 'jira':
          await this._exportToJira(backlog, options);
          break;
        case 'azure':
          await this._exportToAzureDevOps(backlog, options);
          break;
        case 'markdown':
          await this._exportToMarkdown(backlog);
          break;
        case 'json':
          await this._exportToJSON(backlog);
          break;
      }

      vscode.window.showInformationMessage(`Backlog exported to ${target} successfully!`);
    } catch (error) {
      vscode.window.showErrorMessage(`Export failed: ${(error as Error).message}`);
    }
  }

  private async _exportToGitHub(backlog: GeneratedBacklog, options: Record<string, unknown>) {
    const { Octokit } = await import('@octokit/rest');
    const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
    const octokit = new Octokit({ auth: session.accessToken });

    // Get current repo info
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    const repo = gitExtension?.getAPI(1).repositories[0];
    const remoteUrl = repo?.state.remotes[0]?.fetchUrl;
    const [owner, repoName] = this._parseGitHubUrl(remoteUrl);

    // Create milestone if requested
    let milestoneNumber: number | undefined;
    if (options.createMilestone) {
      const milestone = await octokit.issues.createMilestone({
        owner,
        repo: repoName,
        title: backlog.summary.title,
        description: backlog.summary.description,
      });
      milestoneNumber = milestone.data.number;
    }

    // Create labels if requested
    if (options.createLabels) {
      const labels = ['epic', 'story', 'task', 'planning-wizard'];
      for (const label of labels) {
        try {
          await octokit.issues.createLabel({
            owner,
            repo: repoName,
            name: label,
            color: this._getLabelColor(label),
          });
        } catch {
          // Label might already exist
        }
      }
    }

    // Create issues for each epic and story
    const issueMap = new Map<string, number>();

    for (const epic of backlog.epics) {
      // Create epic issue
      const epicIssue = await octokit.issues.create({
        owner,
        repo: repoName,
        title: `[Epic] ${epic.title}`,
        body: this._formatEpicBody(epic),
        labels: ['epic', 'planning-wizard'],
        milestone: milestoneNumber,
      });
      issueMap.set(epic.id, epicIssue.data.number);

      // Create story issues
      for (const story of epic.stories) {
        const storyIssue = await octokit.issues.create({
          owner,
          repo: repoName,
          title: story.title,
          body: this._formatStoryBody(story, epicIssue.data.number),
          labels: ['story', 'planning-wizard'],
          milestone: milestoneNumber,
        });
        issueMap.set(story.id, storyIssue.data.number);
      }
    }

    // Link dependencies if requested
    if (options.linkDependencies) {
      // Add dependency comments to issues
      for (const epic of backlog.epics) {
        for (const story of epic.stories) {
          if (story.dependencies?.length > 0) {
            const issueNumber = issueMap.get(story.id);
            const depLinks = story.dependencies
              .map(depId => `#${issueMap.get(depId)}`)
              .join(', ');

            await octokit.issues.createComment({
              owner,
              repo: repoName,
              issue_number: issueNumber!,
              body: `**Dependencies:** ${depLinks}`,
            });
          }
        }
      }
    }
  }

  private _postMessage(message: unknown) {
    this._panel.webview.postMessage(message);
  }

  private _updateWebview() {
    this._postMessage({
      type: 'stateUpdate',
      state: this._state,
    });
  }

  private _getHtmlForWebview(): string {
    // Return the HTML for the wizard UI
    // This would be a React/Vue app bundled for webview
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Feature Planning Wizard</title>
      <style>
        /* Wizard styles */
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script src="${this._getResourceUri('wizard.js')}"></script>
    </body>
    </html>`;
  }
}
```

### 4.3 AI Generation Service

```typescript
// tools/vscode-extension/src/services/AIGenerationService.ts
import * as vscode from 'vscode';

interface BacklogGenerationInput {
  feature: FeatureDescription;
  technicalContext: TechnicalContext;
  refinement: RefinementResult;
  projectContext: string;
  moduleContext: string | null;
  relatedADRs: string[];
  patterns: string[];
}

export class AIGenerationService {
  private readonly systemPrompt = `You are an expert Product Manager and Tech Lead who creates detailed, actionable backlogs.

RULES:
1. Create hierarchical structure: Epic > Story > Task > Subtask
2. Stories must follow user story format: As a [user], I want [action], so that [benefit]
3. Each story must have specific, testable acceptance criteria in Given/When/Then format
4. Tasks should be technical and reference specific files when possible
5. Estimate in story points (fibonacci: 1, 2, 3, 5, 8, 13)
6. Identify dependencies between items
7. Follow the project's patterns and conventions
8. Consider the existing architecture and ADRs

OUTPUT FORMAT: Valid JSON matching the provided schema.`;

  async generateBacklog(input: BacklogGenerationInput): Promise<GeneratedBacklog> {
    const prompt = this.buildPrompt(input);

    // Use VS Code Language Model API (Copilot)
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4',
    });

    if (models.length === 0) {
      throw new Error('No Copilot model available');
    }

    const model = models[0];
    const messages = [
      vscode.LanguageModelChatMessage.User(prompt),
    ];

    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

    let fullResponse = '';
    for await (const chunk of response.text) {
      fullResponse += chunk;
    }

    // Parse and validate the response
    const backlog = this.parseBacklogResponse(fullResponse);
    return backlog;
  }

  async improveText(field: string, currentValue: string, context: string): Promise<string> {
    const prompts: Record<string, string> = {
      problemStatement: `Improve this problem statement to be clearer and more specific.
        Keep the core meaning but make it more actionable.
        Context: ${context}
        Current: ${currentValue}`,

      proposedSolution: `Improve this solution description to be more specific and technical.
        Consider the project context and suggest concrete approaches.
        Context: ${context}
        Current: ${currentValue}`,

      technicalApproach: `Suggest a technical approach based on the project's architecture.
        Consider existing patterns, tech stack, and best practices.
        Context: ${context}
        Current: ${currentValue}`,
    };

    const prompt = prompts[field] || `Improve this text: ${currentValue}`;

    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    const model = models[0];

    const response = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );

    let result = '';
    for await (const chunk of response.text) {
      result += chunk;
    }

    return result;
  }

  async generateClarifyingQuestions(input: BacklogGenerationInput): Promise<string[]> {
    const prompt = `Based on this feature description, generate 5-7 clarifying questions
    that would help create a better backlog. Focus on edge cases, technical constraints,
    and business rules that might not be obvious.

    Feature: ${JSON.stringify(input.feature)}
    Technical Context: ${JSON.stringify(input.technicalContext)}
    Project Context: ${input.projectContext}

    Return as JSON array of strings.`;

    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    const response = await models[0].sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );

    let result = '';
    for await (const chunk of response.text) {
      result += chunk;
    }

    return JSON.parse(result);
  }

  private buildPrompt(input: BacklogGenerationInput): string {
    return `${this.systemPrompt}

## Feature Information

**Title:** ${input.feature.featureTitle}

**Problem Statement:**
${input.feature.problemStatement}

**Proposed Solution:**
${input.feature.proposedSolution}

**Target Users:** ${input.feature.targetUsers.join(', ')}

**Business Value:** ${input.feature.businessValue}

**Success Metrics:**
${input.feature.successMetrics || 'Not specified'}

## Technical Context

**Primary Module:** ${input.technicalContext.primaryModule}

**Affected Modules:** ${input.technicalContext.affectedModules.join(', ')}

**Non-Functional Requirements:**
${JSON.stringify(input.technicalContext.nonFunctionalRequirements, null, 2)}

**Known Risks:**
${input.technicalContext.knownRisks || 'None specified'}

## Project Context

${input.projectContext}

## Module Context

${input.moduleContext || 'No specific module context'}

## Related Architecture Decisions

${input.relatedADRs.join('\n\n---\n\n')}

## Team Patterns

${input.patterns.join('\n\n---\n\n')}

## Refinement Notes

${JSON.stringify(input.refinement, null, 2)}

---

Generate a complete, detailed backlog for this feature. Include:
1. 2-4 Epics that group related functionality
2. 3-6 User Stories per Epic with clear acceptance criteria
3. Technical tasks for each story with file references where applicable
4. Dependencies between stories
5. Suggested implementation order
6. Risk assessment

Return ONLY valid JSON matching this schema:
{
  "summary": { "totalEpics": number, "totalStories": number, "estimatedPoints": number },
  "epics": [...],
  "implementationOrder": [...],
  "risks": [...]
}`;
  }

  private parseBacklogResponse(response: string): GeneratedBacklog {
    // Extract JSON from response (might have markdown formatting)
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                      response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not parse backlog response');
    }

    const json = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(json);
  }
}
```

---

## 5. CLI Integration

```typescript
// tools/cli/src/commands/plan.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { MemoryBankService } from '../lib/memory-bank';
import { AIService } from '../lib/ai-service';
import { ExportService } from '../lib/export-service';

export const planCommand = new Command('plan')
  .description('Start the Feature Planning Wizard')
  .option('-i, --interactive', 'Run in interactive mode (default)', true)
  .option('-f, --file <path>', 'Load feature description from JSON file')
  .option('-o, --output <path>', 'Output path for generated backlog')
  .option('--export <target>', 'Export target: github, jira, azure, markdown, json')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧙 Feature Planning Wizard\n'));

    const memoryBank = new MemoryBankService();
    const aiService = new AIService();

    // Step 1: Feature Description
    console.log(chalk.yellow('Step 1: Describe your feature\n'));

    const step1 = await inquirer.prompt([
      {
        type: 'input',
        name: 'featureTitle',
        message: 'Feature title:',
        validate: (input) => input.length > 0 || 'Title is required',
      },
      {
        type: 'editor',
        name: 'problemStatement',
        message: 'What problem does this solve? (opens editor)',
      },
      {
        type: 'editor',
        name: 'proposedSolution',
        message: 'Proposed solution:',
      },
      {
        type: 'checkbox',
        name: 'targetUsers',
        message: 'Who will use this feature?',
        choices: [
          { name: 'End Users', value: 'end_users' },
          { name: 'Administrators', value: 'admins' },
          { name: 'Developers (API)', value: 'developers' },
          { name: 'External Systems', value: 'external_systems' },
        ],
      },
      {
        type: 'list',
        name: 'businessValue',
        message: 'Business value:',
        choices: [
          { name: '🔴 Critical', value: 'critical' },
          { name: '🟠 High', value: 'high' },
          { name: '🟡 Medium', value: 'medium' },
          { name: '🟢 Low', value: 'low' },
        ],
      },
    ]);

    // Step 2: Technical Context
    console.log(chalk.yellow('\nStep 2: Technical Context\n'));

    const modules = await memoryBank.getModules();

    const step2 = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'affectedModules',
        message: 'Affected modules:',
        choices: modules.map(m => ({ name: m.name, value: m.id })),
      },
      {
        type: 'list',
        name: 'primaryModule',
        message: 'Primary module:',
        choices: (answers) => answers.affectedModules,
      },
      {
        type: 'checkbox',
        name: 'nfrs',
        message: 'Non-functional requirements:',
        choices: [
          { name: '⚡ Performance requirements', value: 'performance' },
          { name: '📈 Scalability requirements', value: 'scalability' },
          { name: '🔒 Security requirements', value: 'security' },
          { name: '📋 Compliance requirements', value: 'compliance' },
        ],
      },
      {
        type: 'editor',
        name: 'knownRisks',
        message: 'Known risks (optional):',
      },
    ]);

    // Step 3: AI Refinement
    console.log(chalk.yellow('\nStep 3: AI Refinement\n'));

    const spinner = ora('Analyzing feature and generating questions...').start();

    const questions = await aiService.generateClarifyingQuestions({
      feature: step1,
      technicalContext: step2,
    });

    spinner.succeed('Generated clarifying questions');

    console.log(chalk.cyan('\nPlease answer these clarifying questions:\n'));

    const clarifications = await inquirer.prompt(
      questions.map((q, i) => ({
        type: 'input',
        name: `q${i}`,
        message: q,
      }))
    );

    // Step 4: Generate Backlog
    console.log(chalk.yellow('\nStep 4: Generating Backlog\n'));

    const genSpinner = ora('Generating detailed backlog with AI...').start();

    const context = await memoryBank.getProjectContext();
    const patterns = await memoryBank.getPatterns();
    const adrs = await memoryBank.findRelatedADRs(step2.affectedModules);

    const backlog = await aiService.generateBacklog({
      feature: step1,
      technicalContext: step2,
      refinement: { questions, clarifications },
      projectContext: context,
      patterns,
      relatedADRs: adrs,
    });

    genSpinner.succeed('Backlog generated!');

    // Display summary
    console.log(chalk.green.bold('\n📋 Backlog Summary\n'));
    console.log(`  Epics: ${backlog.summary.totalEpics}`);
    console.log(`  Stories: ${backlog.summary.totalStories}`);
    console.log(`  Total Points: ${backlog.summary.estimatedPoints}`);
    console.log(`  Suggested Sprints: ${backlog.summary.suggestedSprints}`);

    // Step 5: Export
    const { exportChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'exportChoice',
        message: 'Where would you like to export?',
        choices: [
          { name: '📁 Save to Memory Bank', value: 'memory-bank' },
          { name: '🐙 Export to GitHub Issues', value: 'github' },
          { name: '📋 Export to Jira', value: 'jira' },
          { name: '☁️ Export to Azure DevOps', value: 'azure' },
          { name: '📄 Export to Markdown', value: 'markdown' },
          { name: '💾 Export to JSON', value: 'json' },
          { name: '❌ Skip export', value: 'skip' },
        ],
      },
    ]);

    if (exportChoice !== 'skip') {
      const exportService = new ExportService();
      await exportService.export(backlog, exportChoice, options);
      console.log(chalk.green(`\n✅ Exported to ${exportChoice}!`));
    }

    // Save to Memory Bank
    const { saveToMB } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveToMB',
        message: 'Save planning session to Memory Bank?',
        default: true,
      },
    ]);

    if (saveToMB) {
      await memoryBank.savePlanningSession({
        feature: step1,
        context: step2,
        backlog,
        timestamp: new Date().toISOString(),
      });
      console.log(chalk.green('✅ Saved to .memory-bank/planning/'));
    }

    console.log(chalk.blue.bold('\n🎉 Planning complete!\n'));
  });
```

---

## 6. Web Dashboard View

### 6.1 Planning Page

```typescript
// tools/web-dashboard/src/app/plan/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wizard } from '@/components/planning/Wizard';
import { BacklogVisualizer } from '@/components/planning/BacklogVisualizer';
import { ExportPanel } from '@/components/planning/ExportPanel';
import { useMemoryBank } from '@/hooks/useMemoryBank';
import { useAIGeneration } from '@/hooks/useAIGeneration';

export default function PlanningPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [generatedBacklog, setGeneratedBacklog] = useState<Backlog | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { modules, patterns, getContext } = useMemoryBank();
  const { generateBacklog, improveText } = useAIGeneration();

  const handleStepComplete = async (step: number, data: unknown) => {
    setWizardData(prev => ({ ...prev, [`step${step}`]: data }));

    if (step === 3) {
      // Generate backlog
      setIsGenerating(true);
      try {
        const context = await getContext();
        const backlog = await generateBacklog({
          ...wizardData,
          step3: data,
          context,
        });
        setGeneratedBacklog(backlog);
        setCurrentStep(4);
      } finally {
        setIsGenerating(false);
      }
    } else {
      setCurrentStep(step + 1);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">🧙 Feature Planning Wizard</h1>

      {/* Progress Steps */}
      <div className="flex justify-between mb-8">
        {['Describe', 'Context', 'Refine', 'Review', 'Export'].map((label, i) => (
          <div
            key={i}
            className={`flex items-center ${i < currentStep ? 'text-green-600' : 'text-gray-400'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center
              ${i + 1 === currentStep ? 'bg-blue-600 text-white' :
                i + 1 < currentStep ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
            >
              {i + 1 < currentStep ? '✓' : i + 1}
            </div>
            <span className="ml-2">{label}</span>
            {i < 4 && <div className="w-full h-1 bg-gray-200 mx-4" />}
          </div>
        ))}
      </div>

      {/* Wizard Steps */}
      {currentStep <= 3 && (
        <Wizard
          step={currentStep}
          modules={modules}
          patterns={patterns}
          onComplete={handleStepComplete}
          onBack={() => setCurrentStep(s => Math.max(1, s - 1))}
          onAIAssist={improveText}
        />
      )}

      {/* Backlog Visualizer */}
      {currentStep === 4 && generatedBacklog && (
        <BacklogVisualizer
          backlog={generatedBacklog}
          onEdit={(updated) => setGeneratedBacklog(updated)}
          onNext={() => setCurrentStep(5)}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {/* Export Panel */}
      {currentStep === 5 && generatedBacklog && (
        <ExportPanel
          backlog={generatedBacklog}
          onExport={async (target, options) => {
            // Handle export
          }}
          onSaveToMemoryBank={async () => {
            // Save to memory bank
          }}
          onBack={() => setCurrentStep(4)}
        />
      )}

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg">Generating backlog with AI...</p>
            <p className="text-sm text-gray-500">This may take a moment</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 6.2 Backlog Visualizer Component

```typescript
// tools/web-dashboard/src/components/planning/BacklogVisualizer.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanView } from './views/KanbanView';
import { TimelineView } from './views/TimelineView';
import { DependencyGraph } from './views/DependencyGraph';
import { TreeView } from './views/TreeView';
import { TableView } from './views/TableView';

interface BacklogVisualizerProps {
  backlog: Backlog;
  onEdit: (backlog: Backlog) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BacklogVisualizer({ backlog, onEdit, onNext, onBack }: BacklogVisualizerProps) {
  const [activeView, setActiveView] = useState('kanban');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          title="Epics"
          value={backlog.summary.totalEpics}
          icon="📦"
        />
        <SummaryCard
          title="Stories"
          value={backlog.summary.totalStories}
          icon="📝"
        />
        <SummaryCard
          title="Story Points"
          value={backlog.summary.estimatedPoints}
          icon="🎯"
        />
        <SummaryCard
          title="Suggested Sprints"
          value={backlog.summary.suggestedSprints}
          icon="🏃"
        />
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="kanban">📋 Kanban</TabsTrigger>
          <TabsTrigger value="timeline">📅 Timeline</TabsTrigger>
          <TabsTrigger value="dependencies">🔗 Dependencies</TabsTrigger>
          <TabsTrigger value="tree">🌳 Tree</TabsTrigger>
          <TabsTrigger value="table">📊 Table</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <KanbanView backlog={backlog} onEdit={onEdit} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineView backlog={backlog} />
        </TabsContent>

        <TabsContent value="dependencies">
          <DependencyGraph backlog={backlog} />
        </TabsContent>

        <TabsContent value="tree">
          <TreeView backlog={backlog} onEdit={onEdit} />
        </TabsContent>

        <TabsContent value="table">
          <TableView backlog={backlog} onEdit={onEdit} />
        </TabsContent>
      </Tabs>

      {/* Risks Section */}
      {backlog.risks.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-bold mb-4">⚠️ Identified Risks</h3>
          <div className="space-y-2">
            {backlog.risks.map((risk, i) => (
              <RiskCard key={i} risk={risk} />
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onBack} className="btn btn-secondary">
          ← Back to Refinement
        </button>
        <button onClick={onNext} className="btn btn-primary">
          Export Backlog →
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Integración con Memory Bank

### 7.1 Estructura de Almacenamiento

```
.memory-bank/
├── planning/
│   ├── {feature-slug}/
│   │   ├── feature.md           # Descripción de la feature
│   │   ├── backlog.json         # Backlog generado
│   │   ├── backlog.md           # Backlog en Markdown
│   │   ├── session.json         # Datos de la sesión de planificación
│   │   └── exports/
│   │       ├── github-issues.json
│   │       └── jira-export.json
│   └── index.json               # Índice de todas las features planificadas
```

### 7.2 Schema para Planning

```json
// core/memory-bank/schemas/planning-session.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Planning Session",
  "type": "object",
  "required": ["id", "feature", "backlog", "createdAt"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the planning session"
    },
    "feature": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "problemStatement": { "type": "string" },
        "proposedSolution": { "type": "string" },
        "targetUsers": { "type": "array", "items": { "type": "string" } },
        "businessValue": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
        "successMetrics": { "type": "string" }
      },
      "required": ["title", "problemStatement", "proposedSolution"]
    },
    "technicalContext": {
      "type": "object",
      "properties": {
        "primaryModule": { "type": "string" },
        "affectedModules": { "type": "array", "items": { "type": "string" } },
        "nonFunctionalRequirements": { "type": "object" },
        "integrations": { "type": "array", "items": { "type": "string" } },
        "knownRisks": { "type": "string" }
      }
    },
    "refinement": {
      "type": "object",
      "properties": {
        "questions": { "type": "array", "items": { "type": "string" } },
        "answers": { "type": "object" },
        "aiSuggestions": { "type": "array", "items": { "type": "string" } }
      }
    },
    "backlog": {
      "$ref": "#/definitions/GeneratedBacklog"
    },
    "exports": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "target": { "type": "string" },
          "exportedAt": { "type": "string", "format": "date-time" },
          "itemsCreated": { "type": "number" }
        }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "createdBy": { "type": "string" }
  },
  "definitions": {
    "GeneratedBacklog": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "object",
          "properties": {
            "totalEpics": { "type": "number" },
            "totalStories": { "type": "number" },
            "totalTasks": { "type": "number" },
            "estimatedPoints": { "type": "number" },
            "suggestedSprints": { "type": "number" }
          }
        },
        "epics": {
          "type": "array",
          "items": { "$ref": "#/definitions/Epic" }
        },
        "implementationOrder": {
          "type": "array",
          "items": { "$ref": "#/definitions/Phase" }
        },
        "risks": {
          "type": "array",
          "items": { "$ref": "#/definitions/Risk" }
        }
      }
    },
    "Epic": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "priority": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
        "estimatedPoints": { "type": "number" },
        "stories": {
          "type": "array",
          "items": { "$ref": "#/definitions/Story" }
        }
      }
    },
    "Story": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "asA": { "type": "string" },
        "iWant": { "type": "string" },
        "soThat": { "type": "string" },
        "acceptanceCriteria": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "given": { "type": "string" },
              "when": { "type": "string" },
              "then": { "type": "string" }
            }
          }
        },
        "estimatedPoints": { "type": "number" },
        "dependencies": { "type": "array", "items": { "type": "string" } },
        "tasks": {
          "type": "array",
          "items": { "$ref": "#/definitions/Task" }
        }
      }
    },
    "Task": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "type": { "type": "string", "enum": ["backend", "frontend", "database", "infrastructure", "testing", "documentation"] },
        "description": { "type": "string" },
        "filesToModify": { "type": "array", "items": { "type": "string" } },
        "filesToCreate": { "type": "array", "items": { "type": "string" } },
        "technicalNotes": { "type": "string" },
        "estimatedHours": { "type": "number" }
      }
    },
    "Risk": {
      "type": "object",
      "properties": {
        "description": { "type": "string" },
        "probability": { "type": "string", "enum": ["high", "medium", "low"] },
        "impact": { "type": "string", "enum": ["high", "medium", "low"] },
        "mitigation": { "type": "string" }
      }
    },
    "Phase": {
      "type": "object",
      "properties": {
        "phase": { "type": "number" },
        "name": { "type": "string" },
        "items": { "type": "array", "items": { "type": "string" } },
        "rationale": { "type": "string" }
      }
    }
  }
}
```

---

## 8. Roadmap de Implementación

### Fase 1: MVP (2 sprints)
- [ ] Formulario básico en VS Code (Steps 1-2)
- [ ] Integración con Copilot para generación
- [ ] Export a Markdown y JSON
- [ ] Guardado en Memory Bank

### Fase 2: Refinamiento (1 sprint)
- [ ] Step 3: Chat de refinamiento con IA
- [ ] Preguntas de clarificación automáticas
- [ ] Mejora de texto con IA

### Fase 3: Visualización (2 sprints)
- [ ] Vista Kanban
- [ ] Vista Timeline
- [ ] Grafo de dependencias
- [ ] Dashboard web

### Fase 4: Integraciones (2 sprints)
- [ ] Export a GitHub Issues
- [ ] Export a Jira
- [ ] Export a Azure DevOps
- [ ] CLI completo

### Fase 5: Polish (1 sprint)
- [ ] Edición inline del backlog generado
- [ ] Templates de features
- [ ] Historial de planificaciones
- [ ] Analytics de estimaciones vs realidad

---

## 9. Métricas de Éxito

| Métrica | Objetivo | Medición |
|---------|----------|----------|
| Tiempo de planificación | -60% vs manual | Tiempo desde inicio hasta backlog exportado |
| Cobertura de requisitos | +40% | Requisitos identificados vs descubiertos después |
| Precisión de estimaciones | ±20% | Puntos estimados vs puntos reales |
| Adopción | 80% del equipo | % de features planificadas con el wizard |
| Satisfacción | NPS > 8 | Encuesta post-uso |

---

> **Siguiente paso**: Implementar MVP del formulario en VS Code Extension
