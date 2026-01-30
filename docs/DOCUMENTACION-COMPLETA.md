# Documentación Completa - Everything GitHub Copilot Enterprise (EGCE)

**Versión**: 1.0.0
**Última actualización**: Enero 2026
**Licencia**: MIT

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Requisitos del Sistema](#2-requisitos-del-sistema)
3. [Guía de Instalación Paso a Paso](#3-guía-de-instalación-paso-a-paso)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Componentes Principales](#5-componentes-principales)
6. [Guía de Uso del CLI (egce)](#6-guía-de-uso-del-cli-egce)
7. [Guía de Uso de la Extensión VS Code](#7-guía-de-uso-de-la-extensión-vs-code)
8. [Guía del Memory Bank](#8-guía-del-memory-bank)
9. [Configuración de Stacks Tecnológicos](#9-configuración-de-stacks-tecnológicos)
10. [Flujos de Trabajo en Equipo](#10-flujos-de-trabajo-en-equipo)
11. [Configuración de MCPs Enterprise](#11-configuración-de-mcps-enterprise)
12. [Web Dashboard](#12-web-dashboard)
13. [Memory Service (Backend)](#13-memory-service-backend)
14. [Solución de Problemas](#14-solución-de-problemas)
15. [Referencia Rápida de Comandos](#15-referencia-rápida-de-comandos)

---

## 1. Introducción

### ¿Qué es EGCE?

**Everything GitHub Copilot Enterprise (EGCE)** es un framework de configuración de nivel empresarial para GitHub Copilot que incluye un sistema de **Memory Bank** compartido para equipos.

### ¿Qué problema resuelve?

| Problema | Impacto |
|----------|---------|
| Cada desarrollador tiene su propio contexto | Decisiones arquitectónicas inconsistentes |
| El conocimiento tribal no se comparte | Onboarding lento, errores repetidos |
| Las decisiones de diseño se pierden | Reinvención constante |
| Los patrones del proyecto no están documentados | Codebase heterogéneo |
| El contexto de negocio es individual | Soluciones técnicamente correctas pero funcionalmente incorrectas |

### Solución EGCE

- **Memory Bank**: Sistema de contexto compartido para equipos
- **Java/Spring Stack**: Soporte completo para Spring Boot 3.x/4.x
- **.NET Stack**: Soporte completo para .NET 8/9
- **Team Workflows**: Onboarding, code review, decisiones arquitectónicas
- **Enterprise MCPs**: Integración con Jira, Confluence, Azure DevOps

---

## 2. Requisitos del Sistema

### Requisitos Obligatorios

| Componente | Versión Mínima |
|------------|----------------|
| **Node.js** | 20.0.0 o superior |
| **Git** | 2.x o superior |
| **npm** | 10.x o superior |

### Requisitos Opcionales (según componentes a usar)

| Componente | Requisito |
|------------|-----------|
| **VS Code** | 1.85.0 o superior (para extensión) |
| **GitHub Copilot** | Licencia activa (individual o enterprise) |
| **PostgreSQL** | 15+ con pgvector (para Memory Service) |
| **Redis** | 7+ (para Memory Service) |
| **Docker** | 24+ (para despliegue containerizado) |

### Verificar Requisitos

```bash
# Verificar Node.js
node --version
# Debe mostrar: v20.x.x o superior

# Verificar npm
npm --version
# Debe mostrar: 10.x.x o superior

# Verificar Git
git --version
# Debe mostrar: git version 2.x.x
```

---

## 3. Guía de Instalación Paso a Paso

### 3.1 Instalación del CLI (egce)

#### Opción A: Instalación Global (Recomendado)

```bash
# Instalar globalmente
npm install -g egce

# Verificar instalación
egce --version
```

#### Opción B: Usar npx (Sin instalación)

```bash
# Usar directamente sin instalar
npx egce --help
```

#### Opción C: Desde el código fuente

```bash
# 1. Clonar el repositorio
git clone https://github.com/Mikodes/everything-github-copilot-enterprise.git

# 2. Entrar al directorio
cd everything-github-copilot-enterprise

# 3. Instalar dependencias
npm install

# 4. Compilar el CLI
npm run build --workspace=tools/cli

# 5. Enlazar globalmente
npm link --workspace=tools/cli

# 6. Verificar
egce --version
```

### 3.2 Instalación de la Extensión VS Code

#### Opción A: Desde el Marketplace (cuando esté publicada)

1. Abrir VS Code
2. Ir a Extensions (Ctrl+Shift+X)
3. Buscar "EGCE Memory Bank"
4. Clic en "Install"

#### Opción B: Instalación Manual (VSIX)

```bash
# 1. Ir al directorio de la extensión
cd tools/vscode-extension

# 2. Instalar dependencias
npm install

# 3. Compilar
npm run compile

# 4. Empaquetar
npm run package
# Esto genera: egce-memory-bank-0.1.0.vsix

# 5. Instalar en VS Code
code --install-extension egce-memory-bank-0.1.0.vsix
```

### 3.3 Instalación del Web Dashboard

```bash
# 1. Ir al directorio del dashboard
cd tools/web-dashboard

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# 4. Ejecutar en desarrollo
npm run dev

# 5. Acceder en: http://localhost:3000
```

### 3.4 Instalación del Memory Service (Backend)

#### Opción A: Con Docker (Recomendado)

```bash
# 1. Ir al directorio del servicio
cd tools/memory-service

# 2. Iniciar con Docker Compose
npm run docker:up
# Esto inicia PostgreSQL, Redis y el servicio

# 3. El servicio estará disponible en: http://localhost:3001
```

#### Opción B: Instalación Manual

```bash
# 1. Instalar PostgreSQL 15+ con pgvector
# (varía según sistema operativo)

# 2. Instalar Redis
# (varía según sistema operativo)

# 3. Ir al directorio del servicio
cd tools/memory-service

# 4. Instalar dependencias
npm install

# 5. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales de BD

# 6. Ejecutar migraciones
npm run migrate

# 7. (Opcional) Cargar datos de prueba
npm run seed

# 8. Iniciar el servicio
npm run dev
```

### 3.5 Verificar Instalación Completa

```bash
# Ejecutar diagnóstico del sistema
egce doctor
```

Este comando verifica:
- Versión de Node.js
- Instalación de Git
- Inicialización del Memory Bank
- Estructura de directorios

---

## 4. Estructura del Proyecto

```
everything-github-copilot-enterprise/
├── core/                         # Framework base
│   ├── memory-bank/              # Sistema Memory Bank
│   │   ├── schemas/              # Esquemas JSON de validación
│   │   └── templates/            # Plantillas Markdown
│   ├── agents/                   # 8 agentes IA reutilizables
│   ├── instructions/             # 6 estándares empresariales
│   ├── prompts/                  # 6 prompts principales
│   └── chat-modes/               # 4 modos de chat
│
├── stacks/                       # Configuraciones por tecnología
│   ├── java-spring/              # Java/Spring Boot 3.x/4.x
│   └── dotnet/                   # .NET 8/9
│
├── team-workflows/               # Flujos de trabajo colaborativo
│   ├── onboarding/               # Incorporación de desarrolladores
│   ├── code-review/              # Revisión de código
│   ├── architecture/             # Decisiones arquitectónicas
│   └── knowledge-sharing/        # Compartir conocimiento
│
├── tools/                        # Herramientas
│   ├── cli/                      # CLI `egce`
│   ├── vscode-extension/         # Extensión VS Code
│   ├── memory-service/           # Backend distribuido
│   └── web-dashboard/            # Panel web
│
├── mcp-configs/                  # Configuraciones MCP
│   ├── enterprise/               # GitHub, Azure DevOps, Jira
│   ├── java/                     # Maven, Spring Initializr
│   └── dotnet/                   # NuGet, Azure
│
└── examples/                     # Proyectos de ejemplo
    ├── java-microservices/
    └── dotnet-clean-architecture/
```

---

## 5. Componentes Principales

### 5.1 Memory Bank

El **corazón del proyecto**. Un sistema de contexto compartido que vive en tu repositorio:

```
.memory-bank/
├── project/
│   ├── context.md          # Overview del proyecto
│   ├── architecture.md     # Arquitectura actual
│   ├── tech-stack.md       # Tecnologías
│   └── glossary.md         # Glosario de términos
├── decisions/              # Architecture Decision Records (ADRs)
│   ├── ADR-0001-*.md
│   └── ADR-0002-*.md
├── modules/                # Contexto por módulo
│   ├── users/
│   ├── orders/
│   └── payments/
└── knowledge/
    ├── patterns.md
    ├── antipatterns.md
    └── troubleshooting.md
```

### 5.2 Agentes IA (8 agentes cross-stack)

| Agente | Descripción |
|--------|-------------|
| `architect` | Diseño de sistemas y decisiones arquitectónicas |
| `code-reviewer` | Revisión de código con estándares |
| `security-auditor` | Análisis de seguridad |
| `onboarding-guide` | Guía para nuevos desarrolladores |
| `knowledge-curator` | Mantenimiento del Memory Bank |
| `tech-debt-tracker` | Seguimiento de deuda técnica |
| `performance-analyst` | Análisis de rendimiento |
| `adr-writer` | Generación de ADRs |

### 5.3 Chat Participants (VS Code + Copilot)

| Participant | Uso | Descripción |
|-------------|-----|-------------|
| `@memory-bank` | `@memory-bank search patterns` | Busca en el Memory Bank |
| `@egce` | `@egce /architect` | Asistente enterprise con 3 modos |

### 5.4 Language Model Tools (Copilot Agent Mode)

| Tool | Función |
|------|---------|
| `egce_project_context` | Contexto completo del proyecto |
| `egce_validate_code` | Validar código vs estándares |
| `egce_get_template` | Obtener plantillas de código |
| `egce_search_patterns` | Buscar patrones arquitectónicos |
| `egce_generate_adr` | Generar borradores de ADR |
| `egce_pr_context` | Contexto enriquecido para PRs |
| `egce_suggest_reviewers` | Sugerir revisores |
| `egce_detect_breaking_changes` | Detectar cambios incompatibles |

---

## 6. Guía de Uso del CLI (egce)

### 6.1 Inicializar un Proyecto

```bash
# Ir al directorio de tu proyecto
cd mi-proyecto

# Inicializar EGCE
egce init

# Esto crea:
# - .memory-bank/ (Memory Bank)
# - .github/agents/ (Agentes personalizados)
# - .github/instructions/ (Instrucciones)
# - .github/prompts/ (Prompts)
# - .github/copilot-instructions.md
# - AGENTS.md
```

### 6.2 Añadir un Stack Tecnológico

```bash
# Para Java/Spring
egce add-stack java-spring
# Opcionalmente especificar versión:
egce add-stack java-spring --version 3.2

# Para .NET
egce add-stack dotnet
# Opcionalmente especificar versión:
egce add-stack dotnet --version 8
```

### 6.3 Comandos del Memory Bank

```bash
# Inicializar solo el Memory Bank
egce memory init

# Validar estructura
egce memory validate
# Con auto-corrección:
egce memory validate --fix

# Sincronizar con remoto
egce memory sync
# Simulación sin cambios reales:
egce memory sync --dry-run

# Exportar para dashboard
egce memory export
# Especificar archivo de salida:
egce memory export -o memory-bank.json

# Añadir una decisión arquitectónica (ADR)
egce memory add-decision "Usar PostgreSQL como base de datos principal"

# Añadir un módulo
egce memory add-module order-service
egce memory add-module user-service
egce memory add-module payment-gateway
```

### 6.4 Validación

```bash
# Validar todo
egce validate

# Validar solo Memory Bank
egce validate --memory-bank

# Validar solo agentes
egce validate --agents

# Validar solo instrucciones
egce validate --instructions
```

### 6.5 Migración desde Claude Code

```bash
# Migrar configuración existente
egce migrate --from claude-code --path ./claude-config

# Simular migración sin ejecutar
egce migrate --from claude-code --path ./claude-config --dry-run
```

### 6.6 Diagnóstico del Sistema

```bash
# Ver estado del sistema
egce doctor
```

---

## 7. Guía de Uso de la Extensión VS Code

### 7.1 Activación

La extensión se activa automáticamente cuando:
- Existe un directorio `.memory-bank/` en tu workspace
- Abres cualquier vista del Memory Bank
- Usas los chat participants

### 7.2 Panel Lateral (Activity Bar)

La extensión añade un icono **Memory Bank** en la barra lateral con 5 vistas:

1. **Explorer**: Navegación de archivos del Memory Bank
2. **Agents**: Selector de agentes disponibles
3. **Decisions (ADRs)**: Timeline de decisiones arquitectónicas
4. **Collaborators**: Presencia de miembros del equipo
5. **Team Chat**: Chat contextual rápido

### 7.3 Comandos Principales (Ctrl+Shift+P)

| Comando | Descripción |
|---------|-------------|
| `EGCE: Initialize Memory Bank Project` | Inicializar nuevo proyecto |
| `EGCE: Add Architecture Decision Record` | Crear nuevo ADR |
| `EGCE: Validate Memory Bank` | Validar estructura |
| `EGCE: Refresh Memory Bank` | Actualizar vista |
| `EGCE: Select Agent` | Seleccionar agente activo |
| `EGCE: Toggle Contextual Hovers` | Activar/desactivar hovers |
| `EGCE: Toggle ADR Badges` | Mostrar/ocultar badges ADR |
| `EGCE: Generate PR Context` | Generar contexto para PR |
| `EGCE: Suggest PR Reviewers` | Sugerir revisores |
| `EGCE: Detect Breaking Changes` | Detectar cambios incompatibles |

### 7.4 Uso de Chat Participants

#### @memory-bank - Buscar en Memory Bank

```
@memory-bank search repository pattern
@memory-bank /decisions database selection
@memory-bank /patterns authentication
@memory-bank /context current file
@memory-bank /help
```

#### @egce - Asistente Enterprise

```
# Modo Arquitectura
@egce /architect diseñar microservicios para pagos

# Modo Desarrollo
@egce /dev implementar endpoint de usuarios

# Modo Revisión
@egce /review revisar cambios actuales

# Ver contexto cargado
@egce /context

# Ver estándares del equipo
@egce /standards
```

### 7.5 Configuración de la Extensión

Abre Settings (Ctrl+,) y busca "EGCE":

| Configuración | Descripción | Default |
|---------------|-------------|---------|
| `egce.memoryBankPath` | Ruta al Memory Bank | `.memory-bank` |
| `egce.autoValidate` | Validar al guardar | `true` |
| `egce.defaultStack` | Stack por defecto | `generic` |
| `egce.contextualHovers.enabled` | Hovers contextuales | `true` |
| `egce.adrBadges.enabled` | Badges de ADR | `true` |
| `egce.collaboration.enabled` | Colaboración real-time | `true` |
| `egce.egce.defaultMode` | Modo por defecto @egce | `dev` |
| `egce.agentMode.enabled` | Integración Agent Mode | `true` |
| `egce.prContext.enabled` | Generación contexto PR | `true` |

---

## 8. Guía del Memory Bank

### 8.1 Concepto

El Memory Bank es un directorio estructurado que:
- **Persiste contexto** entre sesiones
- **Comparte conocimiento** entre el equipo
- **Sirve como documentación viva**
- **Se integra con Copilot** para asistencia contextual

### 8.2 Crear el Memory Bank

```bash
# Opción 1: Con CLI
egce memory init

# Opción 2: Manualmente
mkdir -p .memory-bank/{project,team,modules,decisions,knowledge}
```

### 8.3 Configurar Contexto del Proyecto

Edita `.memory-bank/project/context.md`:

```markdown
---
name: Mi Proyecto
description: Descripción breve del proyecto
version: 1.0.0
lastUpdated: 2026-01-30
status: development
---

# Contexto del Proyecto

## Visión General
[Descripción del proyecto y su propósito]

## Stack Tecnológico
- **Lenguaje**: Java 21
- **Framework**: Spring Boot 3.2
- **Base de Datos**: PostgreSQL 15
- **Mensajería**: Apache Kafka

## Arquitectura
[Descripción de la arquitectura]

## Estándares de Calidad
- Cobertura de tests: >80%
- Sin código duplicado
- Documentación actualizada
```

### 8.4 Añadir Módulos

```bash
# Crear módulo
egce memory add-module order-service
```

Edita `.memory-bank/modules/order-service/context.md`:

```markdown
---
name: Order Service
description: Servicio de gestión de pedidos
owner: team-orders
status: active
---

# Order Service

## Responsabilidades
- Crear pedidos
- Gestionar estado de pedidos
- Calcular precios

## Dependencias
- User Service (autenticación)
- Inventory Service (stock)
- Payment Service (pagos)

## API
- POST /orders - Crear pedido
- GET /orders/{id} - Obtener pedido
- PUT /orders/{id}/status - Actualizar estado
```

### 8.5 Registrar Decisiones (ADRs)

```bash
# Crear ADR
egce memory add-decision "Usar PostgreSQL para persistencia"
```

Estructura del ADR generado:

```markdown
---
id: ADR-0001
title: Usar PostgreSQL para persistencia
date: 2026-01-30
status: proposed
deciders: [Equipo de arquitectura]
---

# ADR-0001: Usar PostgreSQL para persistencia

## Contexto
[¿Por qué se necesita esta decisión?]

## Decisión
[¿Qué se decidió?]

## Consecuencias

### Positivas
- [Beneficio 1]
- [Beneficio 2]

### Negativas
- [Desventaja 1]
- [Desventaja 2]

## Alternativas Consideradas
1. [Alternativa 1]
2. [Alternativa 2]
```

### 8.6 Base de Conocimiento

#### Patrones (`.memory-bank/knowledge/patterns.md`)

```markdown
# Patrones Aprobados

## Repository Pattern
### Cuándo usar
- Abstracción de acceso a datos
- Múltiples fuentes de datos
- Testing unitario

### Implementación
[Ejemplo de código...]

## Service Layer Pattern
### Cuándo usar
- Lógica de negocio compleja
- Transacciones
- Orquestación de operaciones
```

#### Anti-patrones (`.memory-bank/knowledge/antipatterns.md`)

```markdown
# Anti-patrones a Evitar

## Service Locator
### Por qué evitar
- Dependencias ocultas
- Difícil de testear
- Viola principios DI

### Alternativa
Usar inyección de dependencias por constructor
```

#### Troubleshooting (`.memory-bank/knowledge/troubleshooting.md`)

```markdown
# Guía de Troubleshooting

## Connection Pool Exhaustion

### Síntomas
- TimeoutException en logs
- Tiempos de respuesta lentos

### Solución
1. Verificar conexiones no cerradas
2. Aumentar tamaño del pool
3. Configurar timeout de conexión
```

---

## 9. Configuración de Stacks Tecnológicos

### 9.1 Java/Spring Stack

```bash
# Añadir stack
egce add-stack java-spring --version 3.2
```

#### Versiones soportadas:
- Java: 17, 21, 25
- Spring Boot: 3.5.x (LTS), 4.0.x (latest)

#### Agentes especializados incluidos:
| Agente | Descripción |
|--------|-------------|
| `spring-architect` | Experto en Spring Boot/Cloud |
| `jpa-specialist` | Optimización JPA/Hibernate |
| `spring-security-expert` | Seguridad en Spring |
| `spring-cloud-expert` | Patrones de microservicios |
| `gradle-maven-expert` | Build tools |
| `reactive-specialist` | Programación reactiva |

#### Instrucciones incluidas:
- `spring-boot-4.instructions.md`
- `spring-data-jpa.instructions.md`
- `hexagonal-architecture.instructions.md`
- `virtual-threads.instructions.md`
- `spring-security.instructions.md`

### 9.2 .NET Stack

```bash
# Añadir stack
egce add-stack dotnet --version 8
```

#### Versiones soportadas:
- .NET: 8 (LTS), 9
- C#: 12

#### Agentes especializados incluidos:
| Agente | Descripción |
|--------|-------------|
| `dotnet-architect` | Experto en arquitectura .NET |
| `ef-core-specialist` | Entity Framework Core |
| `aspnet-security-expert` | Seguridad ASP.NET |
| `minimal-apis-expert` | Minimal APIs |
| `blazor-specialist` | Componentes Blazor |
| `azure-integration` | Integración Azure |

#### Instrucciones incluidas:
- `dotnet-9-features.instructions.md`
- `ef-core-8.instructions.md`
- `clean-architecture.instructions.md`
- `aspire.instructions.md`
- `minimal-apis.instructions.md`

---

## 10. Flujos de Trabajo en Equipo

### 10.1 Onboarding de Nuevos Desarrolladores

```bash
# En VS Code Copilot Chat
@workspace /onboard-developer
```

El agente de onboarding:
1. Lee el Memory Bank
2. Explica la arquitectura
3. Lista las convenciones del equipo
4. Sugiere primeras tareas

### 10.2 Code Review

```bash
# Revisar un PR
@workspace /review-pr #123

# O con @egce
@egce /review revisar cambios en el módulo de pagos
```

### 10.3 Documentar Decisiones

```bash
# Crear ADR desde Copilot
@workspace /document-decision "Por qué elegimos PostgreSQL"

# O con el CLI
egce memory add-decision "Por qué elegimos PostgreSQL"
```

### 10.4 Compartir Conocimiento

```bash
# Documentar un aprendizaje
@workspace /add-knowledge "Solución a memory leak en pool de conexiones"
```

---

## 11. Configuración de MCPs Enterprise

### 11.1 GitHub MCP

Crear `.vscode/mcp.json`:

```json
{
  "servers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@github/mcp-server"]
    }
  }
}
```

Funcionalidades:
- Gestión de repositorios
- Pull Requests
- Issues
- GitHub Actions
- Commits y branches

### 11.2 Azure DevOps MCP

```json
{
  "servers": {
    "azure-devops": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}"],
      "env": {
        "AZURE_DEVOPS_TOKEN": "${env:AZURE_DEVOPS_PAT}"
      }
    }
  }
}
```

### 11.3 Atlassian (Jira/Confluence) MCP

```json
{
  "servers": {
    "atlassian": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-atlassian"],
      "env": {
        "ATLASSIAN_API_TOKEN": "${env:ATLASSIAN_TOKEN}",
        "ATLASSIAN_EMAIL": "${env:ATLASSIAN_EMAIL}"
      }
    }
  }
}
```

### 11.4 SonarQube MCP

```json
{
  "servers": {
    "sonarqube": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sonarqube/mcp"],
      "env": {
        "SONAR_HOST_URL": "${env:SONAR_URL}",
        "SONAR_TOKEN": "${env:SONAR_TOKEN}"
      }
    }
  }
}
```

---

## 12. Web Dashboard

### 12.1 Iniciar el Dashboard

```bash
cd tools/web-dashboard
npm install
npm run dev
```

Acceder en: `http://localhost:3000`

### 12.2 Funcionalidades

- **Memory Bank Explorer**: Visualización del contexto
- **ADR Timeline**: Historial de decisiones
- **Knowledge Base**: Búsqueda de patrones
- **Team Management**: Gestión de equipo
- **Settings**: Configuración

### 12.3 Configuración de Autenticación

Editar `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secreto-seguro

# GitHub OAuth (opcional)
GITHUB_ID=tu-github-client-id
GITHUB_SECRET=tu-github-client-secret
```

---

## 13. Memory Service (Backend)

### 13.1 Arquitectura

- **Framework**: Fastify
- **Base de Datos**: PostgreSQL + pgvector
- **Caché**: Redis
- **ORM**: Drizzle ORM
- **Autenticación**: JWT

### 13.2 Configuración

Crear archivo `.env`:

```env
# Server
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/egce

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=tu-jwt-secret-muy-seguro

# OpenAI (para embeddings)
OPENAI_API_KEY=tu-openai-api-key
```

### 13.3 Iniciar con Docker

```bash
cd tools/memory-service
docker-compose up -d
```

### 13.4 Endpoints Principales

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Estado del servicio |
| `/api/context` | GET | Obtener contexto |
| `/api/context` | POST | Actualizar contexto |
| `/api/search` | POST | Búsqueda semántica |
| `/api/decisions` | GET | Listar ADRs |
| `/api/decisions` | POST | Crear ADR |

---

## 14. Solución de Problemas

### 14.1 Permisos Denegados al Instalar CLI

```bash
# Usar npx en lugar de instalación global
npx egce init

# O arreglar permisos de npm
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### 14.2 Memory Bank No Encontrado

1. Verificar que `.memory-bank/` existe en la raíz del proyecto
2. Verificar que los archivos tienen frontmatter válido
3. Ejecutar `egce memory validate`

### 14.3 Agentes No Cargan

Verificar:
1. Archivos están en `.github/agents/`
2. Tienen extensión `.agent.md`
3. Tienen frontmatter con `name` y `description`

### 14.4 Extensión VS Code No Se Activa

1. Verificar versión de VS Code >= 1.85.0
2. Crear directorio `.memory-bank/` si no existe
3. Reiniciar VS Code
4. Ver Output > EGCE Memory Bank para logs

### 14.5 Error de Conexión en Memory Service

```bash
# Verificar que PostgreSQL está corriendo
psql -h localhost -U postgres -c "SELECT 1"

# Verificar que Redis está corriendo
redis-cli ping

# Ver logs del servicio
docker-compose logs -f memory-service
```

---

## 15. Referencia Rápida de Comandos

### CLI (egce)

```bash
# Inicialización
egce init                              # Inicializar proyecto
egce add-stack java-spring             # Añadir Java/Spring
egce add-stack dotnet                  # Añadir .NET
egce doctor                            # Diagnóstico

# Memory Bank
egce memory init                       # Inicializar Memory Bank
egce memory validate                   # Validar
egce memory validate --fix             # Validar y corregir
egce memory sync                       # Sincronizar
egce memory export                     # Exportar
egce memory add-decision "Título"      # Añadir ADR
egce memory add-module nombre          # Añadir módulo

# Validación
egce validate                          # Validar todo
egce validate --memory-bank            # Solo Memory Bank
egce validate --agents                 # Solo agentes

# Migración
egce migrate --from claude-code --path ./config
```

### VS Code Chat Participants

```bash
# @memory-bank
@memory-bank search <query>
@memory-bank /decisions
@memory-bank /patterns
@memory-bank /context
@memory-bank /help

# @egce
@egce /architect <pregunta>
@egce /dev <tarea>
@egce /review <código>
@egce /context
@egce /standards
@egce /help
```

### VS Code Commands (Ctrl+Shift+P)

```
EGCE: Initialize Memory Bank Project
EGCE: Add Architecture Decision Record
EGCE: Validate Memory Bank
EGCE: Refresh Memory Bank
EGCE: Select Agent
EGCE: Generate PR Context
EGCE: Suggest PR Reviewers
EGCE: Detect Breaking Changes
EGCE: Toggle Contextual Hovers
EGCE: Toggle ADR Badges
EGCE: Start Collaboration
EGCE: Stop Collaboration
```

---

## Recursos Adicionales

- **Repositorio**: https://github.com/Mikodes/everything-github-copilot-enterprise
- **Issues**: https://github.com/Mikodes/everything-github-copilot-enterprise/issues
- **Documentación adicional**: `/docs/`
- **Ejemplos**: `/examples/`

---

**Desarrollado con amor para equipos enterprise.**
