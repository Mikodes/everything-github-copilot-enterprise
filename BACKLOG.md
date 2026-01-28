# 📋 BACKLOG - Everything GitHub Copilot Enterprise

> **Última actualización**: 2026-01-28
> **Versión objetivo**: 1.0.0
> **Estado**: En desarrollo - Fase 1 (90% completada)

---

## 🎯 Visión del Proyecto

Framework de configuración de GitHub Copilot orientado a equipos de desarrollo enterprise, con soporte para ecosistemas Java/Spring y .NET, y un sistema de Memory Bank compartido para mantener contexto a nivel de equipo.

### Objetivos Principales

1. **Memory Bank para equipos**: Sistema de contexto compartido que resuelve el problema de pérdida de contexto en equipos grandes
2. **Stacks Enterprise**: Soporte completo para Java/Spring Boot 3.x/4.x y .NET 8/9
3. **Migración desde Claude Code**: Herramienta para migrar configuraciones existentes
4. **Herramientas visuales**: VS Code Extension + Web Dashboard

---

## 📊 Estado de Fases

| Fase | Estado | Progreso | Fecha Inicio | Fecha Fin |
|------|--------|----------|--------------|-----------|
| Fase 1: Core + Memory Bank | 🟡 En progreso | 90% | 2025-01-27 | - |
| Fase 2: Java/Spring | 🟢 Completado | 100% | 2025-01-27 | 2025-01-27 |
| Fase 3: .NET | ⚪ Pendiente | 0% | - | - |
| Fase 4: Team Workflows + MCP | ⚪ Pendiente | 0% | - | - |
| Fase 5: VS Code Extension | ⚪ Pendiente | 0% | - | - |
| Fase 6: Web Dashboard | ⚪ Pendiente | 0% | - | - |
| Fase 7: Migrador + Polish | ⚪ Pendiente | 0% | - | - |

### Resumen Fase 1 (Actualizado 2026-01-28)

| Sección | Completado | Total | Porcentaje |
|---------|------------|-------|------------|
| 1.1 Estructura Base | 7 | 8 | 87.5% |
| 1.2 Memory Bank Schemas | 6 | 6 | 100% |
| 1.3 Memory Bank Templates | 6 | 6 | 100% |
| 1.4 Agentes Core | 8 | 8 | 100% |
| 1.5 Instructions Core | 6 | 6 | 100% |
| 1.6 Prompts Core | 6 | 6 | 100% |
| 1.7 Chat Modes Core | 4 | 4 | 100% |
| 1.8 CLI Básico | 4 (+4 parciales) | 8 | ~62.5% |
| 1.9 Documentación | 3 | 3 | 100% |
| 1.10 Tests | 0 | 4 | 0% |
| **Total Fase 1** | **50** | **59** | **~90%** |

### Próximos Pasos para Completar Fase 1

1. **CONTRIBUTING.md** (1.1.7) - Crear guía de contribución
2. **CLI Commands** (1.8.2-5) - Completar lógica de los comandos:
   - `egce init` - Implementar lógica de inicialización
   - `egce memory init` - Implementar inicialización de Memory Bank
   - `egce memory validate` - Implementar validación
   - `egce validate` - Implementar validación de configuración
3. **Tests** (1.10) - Implementar suite de tests:
   - Setup Jest/Vitest
   - Tests para schema-validator
   - Tests para memory-bank lib
   - Tests para CLI commands

**Leyenda**: 🟢 Completado | 🟡 En progreso | ⚪ Pendiente | 🔴 Bloqueado

---

## 📦 FASE 1: Core Framework + Memory Bank

**Duración estimada**: 3 semanas
**Objetivo**: Base sólida del proyecto y sistema Memory Bank funcional

### 1.1 Estructura Base del Proyecto

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.1.1 | Crear estructura de directorios | 🟢 Completado | Alta | Toda la jerarquía de carpetas |
| 1.1.2 | package.json principal | 🟢 Completado | Alta | Monorepo con workspaces |
| 1.1.3 | Configuración TypeScript | 🟢 Completado | Alta | tsconfig.json base |
| 1.1.4 | Configuración ESLint + Prettier | 🟢 Completado | Media | Estándares de código |
| 1.1.5 | .gitignore completo | 🟢 Completado | Alta | - |
| 1.1.6 | README.md principal | 🟢 Completado | Alta | Documentación inicial |
| 1.1.7 | CONTRIBUTING.md | ⚪ Pendiente | Media | Guía de contribución |
| 1.1.8 | LICENSE (MIT) | 🟢 Completado | Alta | - |

### 1.2 Memory Bank - Schemas

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.2.1 | project-context.schema.json | 🟢 Completado | Alta | Contexto general del proyecto |
| 1.2.2 | team-context.schema.json | 🟢 Completado | Alta | Estructura del equipo |
| 1.2.3 | module-context.schema.json | 🟢 Completado | Alta | Contexto por módulo/bounded context |
| 1.2.4 | decision-record.schema.json | 🟢 Completado | Alta | ADRs |
| 1.2.5 | knowledge-entry.schema.json | 🟢 Completado | Alta | Entradas de conocimiento |
| 1.2.6 | session-context.schema.json | 🟢 Completado | Media | Contexto de sesión individual |

### 1.3 Memory Bank - Templates

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.3.1 | project-context.template.md | 🟢 Completado | Alta | Template inicial proyecto |
| 1.3.2 | team-context.template.md | 🟢 Completado | Alta | Template equipo |
| 1.3.3 | module-context.template.md | 🟢 Completado | Alta | Template por módulo |
| 1.3.4 | adr.template.md | 🟢 Completado | Alta | Architecture Decision Record |
| 1.3.5 | knowledge-entry.template.md | 🟢 Completado | Alta | Entrada de conocimiento |
| 1.3.6 | troubleshooting.template.md | 🟢 Completado | Media | Solución de problemas |

### 1.4 Agentes Core

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.4.1 | architect.agent.md | 🟢 Completado | Alta | Agente arquitecto |
| 1.4.2 | code-reviewer.agent.md | 🟢 Completado | Alta | Revisor de código |
| 1.4.3 | security-auditor.agent.md | 🟢 Completado | Alta | Auditor de seguridad |
| 1.4.4 | onboarding-guide.agent.md | 🟢 Completado | Alta | Guía de onboarding |
| 1.4.5 | knowledge-curator.agent.md | 🟢 Completado | Alta | Curador del memory bank |
| 1.4.6 | tech-debt-tracker.agent.md | 🟢 Completado | Media | Tracker de deuda técnica |
| 1.4.7 | performance-analyst.agent.md | 🟢 Completado | Media | Analista de rendimiento |
| 1.4.8 | adr-writer.agent.md | 🟢 Completado | Media | Escritor de ADRs |

### 1.5 Instructions Core

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.5.1 | enterprise-standards.instructions.md | 🟢 Completado | Alta | Estándares enterprise |
| 1.5.2 | git-workflow.instructions.md | 🟢 Completado | Alta | Flujo de Git |
| 1.5.3 | testing-standards.instructions.md | 🟢 Completado | Alta | Estándares de testing |
| 1.5.4 | security-baseline.instructions.md | 🟢 Completado | Alta | Baseline de seguridad |
| 1.5.5 | documentation.instructions.md | 🟢 Completado | Alta | Documentación |
| 1.5.6 | code-review-checklist.instructions.md | 🟢 Completado | Media | Checklist de review |

### 1.6 Prompts Core

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.6.1 | analyze-impact.prompt.md | 🟢 Completado | Alta | Análisis de impacto |
| 1.6.2 | review-pr.prompt.md | 🟢 Completado | Alta | Review de PR |
| 1.6.3 | document-decision.prompt.md | 🟢 Completado | Alta | Documentar decisión |
| 1.6.4 | estimate-task.prompt.md | 🟢 Completado | Media | Estimar tarea |
| 1.6.5 | update-memory-bank.prompt.md | 🟢 Completado | Alta | Actualizar memory bank |
| 1.6.6 | onboard-developer.prompt.md | 🟢 Completado | Alta | Onboarding de dev |

### 1.7 Chat Modes Core

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.7.1 | dev.chatmode.md | 🟢 Completado | Alta | Modo desarrollo |
| 1.7.2 | review.chatmode.md | 🟢 Completado | Alta | Modo review |
| 1.7.3 | architect.chatmode.md | 🟢 Completado | Media | Modo arquitecto |
| 1.7.4 | mentor.chatmode.md | 🟢 Completado | Media | Modo mentor |

### 1.8 CLI Básico

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.8.1 | Estructura CLI (commander.js) | 🟢 Completado | Alta | Setup inicial + package.json |
| 1.8.2 | Comando `egce init` | 🟡 Parcial | Alta | Entry point creado, lógica pendiente |
| 1.8.3 | Comando `egce memory init` | 🟡 Parcial | Alta | Entry point creado, lógica pendiente |
| 1.8.4 | Comando `egce memory validate` | 🟡 Parcial | Alta | Entry point creado, lógica pendiente |
| 1.8.5 | Comando `egce validate` | 🟡 Parcial | Alta | Entry point creado, lógica pendiente |
| 1.8.6 | Lib: memory-bank.ts | 🟢 Completado | Alta | Librería memory bank |
| 1.8.7 | Lib: schema-validator.ts | 🟢 Completado | Alta | Validador de schemas |
| 1.8.8 | Lib: config-generator.ts | 🟢 Completado | Media | Generador de config |

### 1.9 Documentación Fase 1

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.9.1 | docs/getting-started.md | 🟢 Completado | Alta | Guía inicio rápido |
| 1.9.2 | docs/memory-bank-guide.md | 🟢 Completado | Alta | Guía Memory Bank |
| 1.9.3 | docs/team-setup.md | 🟢 Completado | Alta | Setup para equipos |

### 1.10 Tests Fase 1

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 1.10.1 | Setup Jest/Vitest | ⚪ Pendiente | Alta | Framework de testing |
| 1.10.2 | Tests schema-validator | ⚪ Pendiente | Alta | Tests unitarios |
| 1.10.3 | Tests memory-bank lib | ⚪ Pendiente | Alta | Tests unitarios |
| 1.10.4 | Tests CLI commands | ⚪ Pendiente | Media | Tests de integración |

---

## 📦 FASE 2: Stack Java/Spring

**Duración estimada**: 3 semanas
**Objetivo**: Soporte completo para ecosistema Java enterprise
**Dependencias**: Fase 1 completada
**Estado**: ✅ COMPLETADO

### 2.1 Agentes Java/Spring

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 2.1.1 | spring-architect.agent.md | 🟢 Completado | Alta | Arquitecto Spring |
| 2.1.2 | jpa-specialist.agent.md | 🟢 Completado | Alta | Especialista JPA |
| 2.1.3 | spring-security-expert.agent.md | 🟢 Completado | Alta | Experto seguridad |
| 2.1.4 | spring-cloud-expert.agent.md | 🟢 Completado | Alta | Experto Spring Cloud |
| 2.1.5 | reactive-specialist.agent.md | 🟢 Completado | Media | WebFlux, R2DBC |
| 2.1.6 | gradle-maven-expert.agent.md | 🟢 Completado | Media | Build tools |

### 2.2 Instructions Java/Spring

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 2.2.1 | java-21-features.instructions.md | 🟢 Completado | Alta | Features Java 21 |
| 2.2.2 | spring-boot-4.instructions.md | 🟢 Completado | Alta | Spring Boot 4.x |
| 2.2.3 | spring-boot-3.instructions.md | 🟢 Completado | Alta | Spring Boot 3.x LTS |
| 2.2.4 | spring-data-jpa.instructions.md | 🟢 Completado | Alta | Spring Data JPA |
| 2.2.5 | spring-security-7.instructions.md | 🟢 Completado | Alta | Spring Security 7 |
| 2.2.6 | spring-cloud.instructions.md | 🟢 Completado | Alta | Spring Cloud |
| 2.2.7 | junit5-testing.instructions.md | 🟢 Completado | Alta | JUnit 5 |
| 2.2.8 | testcontainers.instructions.md | 🟢 Completado | Alta | Testcontainers |
| 2.2.9 | lombok-mapstruct.instructions.md | 🟢 Completado | Media | Lombok + MapStruct |
| 2.2.10 | hexagonal-architecture.instructions.md | 🟢 Completado | Alta | Arquitectura hexagonal |
| 2.2.11 | virtual-threads.instructions.md | 🟢 Completado | Media | Virtual Threads Java 21+ |

### 2.3 Prompts Java/Spring

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 2.3.1 | create-rest-controller.prompt.md | 🟢 Completado | Alta | Crear controller |
| 2.3.2 | create-service-layer.prompt.md | 🟢 Completado | Alta | Crear service |
| 2.3.3 | create-jpa-entity.prompt.md | 🟢 Completado | Alta | Crear entidad JPA |
| 2.3.4 | add-spring-security.prompt.md | 🟢 Completado | Alta | Añadir seguridad |
| 2.3.5 | create-integration-test.prompt.md | 🟢 Completado | Alta | Test integración |
| 2.3.6 | migrate-to-spring-boot-4.prompt.md | 🟢 Completado | Media | Migrar a SB4 |
| 2.3.7 | add-openapi-docs.prompt.md | 🟢 Completado | Media | Documentación OpenAPI |

### 2.4 Knowledge Base Java/Spring

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 2.4.1 | spring-patterns.md | 🟢 Completado | Alta | Patterns Spring |
| 2.4.2 | spring-antipatterns.md | 🟢 Completado | Alta | Antipatterns |
| 2.4.3 | spring-troubleshooting.md | 🟢 Completado | Alta | Troubleshooting |

### 2.5 Ejemplo Java Microservicios

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 2.5.1 | Estructura ejemplo | 🟢 Completado | Alta | Microservicios ejemplo |
| 2.5.2 | Memory Bank ejemplo | 🟢 Completado | Alta | .memory-bank/ configurado |
| 2.5.3 | README ejemplo | 🟢 Completado | Alta | Documentación |

---

## 📦 FASE 3: Stack .NET

**Duración estimada**: 3 semanas
**Objetivo**: Soporte completo para ecosistema .NET enterprise
**Dependencias**: Fase 1 completada

### 3.1 Agentes .NET

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 3.1.1 | dotnet-architect.agent.md | 🟢 Completado | Alta | Arquitecto .NET |
| 3.1.2 | ef-core-specialist.agent.md | 🟢 Completado | Alta | Especialista EF Core |
| 3.1.3 | aspnet-security-expert.agent.md | 🟢 Completado | Alta | Experto seguridad |
| 3.1.4 | blazor-specialist.agent.md | 🟢 Completado | Media | Especialista Blazor |
| 3.1.5 | minimal-apis-expert.agent.md | 🟢 Completado | Alta | Minimal APIs |
| 3.1.6 | azure-integration.agent.md | 🟢 Completado | Media | Integración Azure |

### 3.2 Instructions .NET

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 3.2.1 | csharp-12-features.instructions.md | 🟢 Completado | Alta | Features C# 12 |
| 3.2.2 | dotnet-9-features.instructions.md | 🟢 Completado | Alta | .NET 9 |
| 3.2.3 | dotnet-8-lts.instructions.md | 🟢 Completado | Alta | .NET 8 LTS |
| 3.2.4 | aspnet-core-patterns.instructions.md | 🟢 Completado | Alta | Patterns ASP.NET |
| 3.2.5 | ef-core-8.instructions.md | 🟢 Completado | Alta | EF Core 8 |
| 3.2.6 | identity-security.instructions.md | 🟢 Completado | Alta | Identity + Security |
| 3.2.7 | minimal-apis.instructions.md | 🟢 Completado | Alta | Minimal APIs |
| 3.2.8 | xunit-testing.instructions.md | 🟢 Completado | Alta | xUnit testing |
| 3.2.9 | mediatr-cqrs.instructions.md | 🟢 Completado | Alta | MediatR + CQRS |
| 3.2.10 | clean-architecture.instructions.md | 🟢 Completado | Alta | Clean Architecture |
| 3.2.11 | aspire.instructions.md | 🟢 Completado | Media | .NET Aspire |

### 3.3 Prompts .NET

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 3.3.1 | create-api-controller.prompt.md | 🟢 Completado | Alta | Crear controller |
| 3.3.2 | create-ef-entity.prompt.md | 🟢 Completado | Alta | Crear entidad EF |
| 3.3.3 | add-identity.prompt.md | 🟢 Completado | Alta | Añadir Identity |
| 3.3.4 | create-blazor-component.prompt.md | 🟢 Completado | Media | Componente Blazor |
| 3.3.5 | create-minimal-api.prompt.md | 🟢 Completado | Alta | Minimal API |
| 3.3.6 | migrate-to-dotnet-9.prompt.md | 🟢 Completado | Media | Migrar a .NET 9 |
| 3.3.7 | add-aspire.prompt.md | 🟢 Completado | Media | Añadir Aspire |

### 3.4 Knowledge Base .NET

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 3.4.1 | dotnet-patterns.md | 🟢 Completado | Alta | Patterns .NET |
| 3.4.2 | dotnet-antipatterns.md | 🟢 Completado | Alta | Antipatterns |
| 3.4.3 | dotnet-troubleshooting.md | 🟢 Completado | Alta | Troubleshooting |

### 3.5 Ejemplo .NET Clean Architecture

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 3.5.1 | Estructura ejemplo | 🟢 Completado | Alta | Clean Architecture ejemplo |
| 3.5.2 | Memory Bank ejemplo | 🟢 Completado | Alta | .memory-bank/ configurado |
| 3.5.3 | README ejemplo | 🟢 Completado | Alta | Documentación |

---

## 📦 FASE 4: Team Workflows + MCP

**Duración estimada**: 2 semanas
**Objetivo**: Flujos de trabajo para equipos y integración enterprise
**Dependencias**: Fase 1 completada

### 4.1 Workflows Onboarding

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 4.1.1 | onboarding-guide.agent.md | ⚪ Pendiente | Alta | Agente onboarding |
| 4.1.2 | codebase-explorer.prompt.md | ⚪ Pendiente | Alta | Explorar codebase |
| 4.1.3 | team-conventions.instructions.md | ⚪ Pendiente | Alta | Convenciones equipo |
| 4.1.4 | first-task-checklist.prompt.md | ⚪ Pendiente | Media | Primera tarea |

### 4.2 Workflows Code Review

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 4.2.1 | team-reviewer.agent.md | ⚪ Pendiente | Alta | Reviewer de equipo |
| 4.2.2 | pr-review-checklist.instructions.md | ⚪ Pendiente | Alta | Checklist PR |
| 4.2.3 | review-feedback.prompt.md | ⚪ Pendiente | Alta | Feedback review |
| 4.2.4 | review-summary.prompt.md | ⚪ Pendiente | Media | Resumen review |

### 4.3 Workflows Arquitectura

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 4.3.1 | architecture-reviewer.agent.md | ⚪ Pendiente | Alta | Reviewer arquitectura |
| 4.3.2 | adr-workflow.prompt.md | ⚪ Pendiente | Alta | Workflow ADR |
| 4.3.3 | tech-radar.instructions.md | ⚪ Pendiente | Media | Tech radar |
| 4.3.4 | architecture-review.prompt.md | ⚪ Pendiente | Alta | Review arquitectura |

### 4.4 Workflows Knowledge Sharing

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 4.4.1 | knowledge-curator.agent.md | ⚪ Pendiente | Alta | Curador conocimiento |
| 4.4.2 | document-learning.prompt.md | ⚪ Pendiente | Alta | Documentar aprendizaje |
| 4.4.3 | update-knowledge-base.prompt.md | ⚪ Pendiente | Alta | Actualizar KB |
| 4.4.4 | retrospective-insights.prompt.md | ⚪ Pendiente | Media | Insights retro |

### 4.5 MCP Configurations

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 4.5.1 | atlassian-rovo.mcp.json | ⚪ Pendiente | Alta | Jira + Confluence |
| 4.5.2 | azure-devops.mcp.json | ⚪ Pendiente | Alta | Azure DevOps |
| 4.5.3 | github.mcp.json | ⚪ Pendiente | Alta | GitHub |
| 4.5.4 | sonarqube.mcp.json | ⚪ Pendiente | Media | SonarQube |

### 4.6 GitHub Actions

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 4.6.1 | sync-memory-bank.yml | ⚪ Pendiente | Alta | Sync memory bank |
| 4.6.2 | validate-config.yml | ⚪ Pendiente | Alta | Validar config |
| 4.6.3 | update-knowledge.yml | ⚪ Pendiente | Media | Actualizar KB |
| 4.6.4 | pr-context-check.yml | ⚪ Pendiente | Media | Check contexto PR |

---

## 📦 FASE 5: VS Code Extension

**Duración estimada**: 2-3 semanas
**Objetivo**: Extensión VS Code para gestión visual del Memory Bank
**Dependencias**: Fase 1, 4 completadas

### 5.1 Setup Extension

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 5.1.1 | Estructura proyecto extension | ⚪ Pendiente | Alta | yo code generator |
| 5.1.2 | package.json extension | ⚪ Pendiente | Alta | Contributes, activation |
| 5.1.3 | extension.ts entry point | ⚪ Pendiente | Alta | Activación |

### 5.2 Memory Bank Provider

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 5.2.1 | TreeView provider | ⚪ Pendiente | Alta | Vista árbol MB |
| 5.2.2 | Context editor | ⚪ Pendiente | Alta | Editor contextos |
| 5.2.3 | Sync functionality | ⚪ Pendiente | Alta | Sincronización |

### 5.3 Comandos Extension

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 5.3.1 | init-project command | ⚪ Pendiente | Alta | Inicializar |
| 5.3.2 | update-context command | ⚪ Pendiente | Alta | Actualizar contexto |
| 5.3.3 | add-decision command | ⚪ Pendiente | Alta | Añadir ADR |
| 5.3.4 | select-agent command | ⚪ Pendiente | Media | Selector agentes |

### 5.4 Publicación

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 5.4.1 | Icons y assets | ⚪ Pendiente | Media | Recursos visuales |
| 5.4.2 | README extension | ⚪ Pendiente | Alta | Documentación |
| 5.4.3 | Publicar en Marketplace | ⚪ Pendiente | Alta | vsce publish |

---

## 📦 FASE 6: Web Dashboard

**Duración estimada**: 2-3 semanas
**Objetivo**: Dashboard web para visualización y gestión del equipo
**Dependencias**: Fase 1, 4 completadas

### 6.1 Setup Dashboard

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 6.1.1 | Next.js 14 setup | ⚪ Pendiente | Alta | App router |
| 6.1.2 | Tailwind + shadcn/ui | ⚪ Pendiente | Alta | UI components |
| 6.1.3 | Layout principal | ⚪ Pendiente | Alta | Navegación |

### 6.2 Vistas Dashboard

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 6.2.1 | Vista Memory Bank | ⚪ Pendiente | Alta | Árbol MB |
| 6.2.2 | Vista Decisions (ADRs) | ⚪ Pendiente | Alta | Timeline ADRs |
| 6.2.3 | Vista Knowledge Base | ⚪ Pendiente | Alta | Búsqueda KB |
| 6.2.4 | Vista Team | ⚪ Pendiente | Media | Actividad equipo |

### 6.3 Componentes

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 6.3.1 | MemoryBankTree component | ⚪ Pendiente | Alta | Árbol navegable |
| 6.3.2 | ContextEditor component | ⚪ Pendiente | Alta | Editor markdown |
| 6.3.3 | ADRTimeline component | ⚪ Pendiente | Alta | Timeline visual |
| 6.3.4 | KnowledgeSearch component | ⚪ Pendiente | Alta | Búsqueda |
| 6.3.5 | TeamActivity component | ⚪ Pendiente | Media | Feed actividad |

### 6.4 Integración

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 6.4.1 | GitHub API integration | ⚪ Pendiente | Alta | Leer repos |
| 6.4.2 | API routes | ⚪ Pendiente | Alta | Backend routes |
| 6.4.3 | Auth (GitHub OAuth) | ⚪ Pendiente | Alta | Autenticación |

### 6.5 Deploy

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 6.5.1 | Configurar Vercel | ⚪ Pendiente | Alta | Deploy |
| 6.5.2 | Dominio custom | ⚪ Pendiente | Media | DNS |
| 6.5.3 | Analytics | ⚪ Pendiente | Baja | Métricas uso |

---

## 📦 FASE 7: Migrador + Polish

**Duración estimada**: 2 semanas
**Objetivo**: Herramienta de migración y refinamiento final
**Dependencias**: Todas las fases anteriores

### 7.1 Migrador Claude Code

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 7.1.1 | Parser CLAUDE.md | ⚪ Pendiente | Alta | Parsear formato Claude |
| 7.1.2 | Parser agents/ Claude | ⚪ Pendiente | Alta | Convertir agentes |
| 7.1.3 | Parser skills/ Claude | ⚪ Pendiente | Alta | Convertir skills |
| 7.1.4 | Parser commands/ Claude | ⚪ Pendiente | Alta | Convertir commands |
| 7.1.5 | Comando `egce migrate` | ⚪ Pendiente | Alta | CLI migración |
| 7.1.6 | Guía migración | ⚪ Pendiente | Alta | Documentación |

### 7.2 Documentación Final

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 7.2.1 | Completar todas las guías | ⚪ Pendiente | Alta | Docs completas |
| 7.2.2 | API reference | ⚪ Pendiente | Alta | Referencia API |
| 7.2.3 | Troubleshooting guide | ⚪ Pendiente | Alta | Guía problemas |
| 7.2.4 | Video tutorials | ⚪ Pendiente | Media | Videos |

### 7.3 Polish

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 7.3.1 | Performance optimization | ⚪ Pendiente | Alta | Optimización |
| 7.3.2 | Error handling mejorado | ⚪ Pendiente | Alta | Manejo errores |
| 7.3.3 | Tests E2E | ⚪ Pendiente | Alta | Tests end-to-end |
| 7.3.4 | Beta testing | ⚪ Pendiente | Alta | Testing usuarios |

### 7.4 Release

| ID | Tarea | Estado | Prioridad | Notas |
|----|-------|--------|-----------|-------|
| 7.4.1 | CHANGELOG.md | ⚪ Pendiente | Alta | Changelog |
| 7.4.2 | npm publish | ⚪ Pendiente | Alta | Publicar CLI |
| 7.4.3 | GitHub release | ⚪ Pendiente | Alta | Release v1.0.0 |
| 7.4.4 | Anuncio/promoción | ⚪ Pendiente | Media | Marketing |

---

## 📝 Notas de Desarrollo

### Decisiones Técnicas

| Fecha | Decisión | Motivo |
|-------|----------|--------|
| 2025-01-27 | Monorepo con npm workspaces | Facilita desarrollo CLI + Extension + Dashboard |
| 2025-01-27 | TypeScript para todo el código | Type safety, mejor DX |
| 2025-01-27 | Commander.js para CLI | Estándar, bien documentado |
| 2025-01-27 | Next.js 14 para dashboard | App router, server components |
| 2025-01-27 | JSON Schema para validación | Estándar, tooling disponible |

### Dependencias Externas

- **MCP Atlassian**: https://github.com/atlassian/atlassian-mcp-server
- **MCP Azure DevOps**: https://github.com/microsoft/azure-devops-mcp
- **Awesome Copilot**: https://github.com/github/awesome-copilot (referencia)

### Versiones Target

| Tecnología | Versión |
|------------|---------|
| Node.js | 20+ |
| Java | 17, 21, 25 |
| Spring Boot | 3.5.x, 4.0.x |
| .NET | 8 (LTS), 9 |
| VS Code Extension API | 1.85+ |

---

## 🔄 Historial de Cambios del Backlog

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2025-01-27 | Creación inicial del backlog | Claude + Mike |
| 2025-01-27 | Completados todos los schemas (1.2) y templates (1.3) del Memory Bank | Claude |
| 2025-01-27 | Completada Fase 1 al 90%: Agentes (1.4), Instructions (1.5), Prompts (1.6), Chat Modes (1.7), CLI libs (1.8.6-8), Docs (1.9), Config (1.1.3-4) | Claude |
| 2025-01-27 | **Completada Fase 2 al 100%**: 6 agentes Java/Spring, 11 instrucciones, 7 prompts, 3 knowledge base files, ejemplo microservicios | Claude |

---

## 📌 Cómo Usar Este Backlog

### Para Claude (en futuras sesiones)

1. Leer este archivo al inicio de cada sesión de trabajo
2. Identificar la fase actual y tareas pendientes
3. Actualizar el estado de las tareas completadas
4. Añadir notas relevantes en la sección correspondiente

### Para el equipo

1. Revisar el backlog antes de cada sprint
2. Actualizar estados tras completar tareas
3. Añadir nuevas tareas según surjan
4. Documentar decisiones técnicas

### Estados de Tarea

- ⚪ **Pendiente**: No iniciada
- 🟡 **En progreso**: En desarrollo activo
- 🟢 **Completada**: Finalizada y testeada
- 🔴 **Bloqueada**: Esperando dependencia o decisión

