---
description: Manage sprint contracts between Orchestrator and Team Leads
argument-hint: <subcommand> [args]
allowed-tools: Read, Write, Bash, Glob, Grep
---

# /devteam:contract

Manages sprint contracts — pre-agreed definitions of done between the Orchestrator and a Team Lead, based on the harness engineering sprint contract pattern.

## Subcommands

```
/devteam:contract create <team-lead> "<task description>"
/devteam:contract list [active|completed|blocked]
/devteam:contract complete <contract-id> [notes]
/devteam:contract report
```

---

## /devteam:contract create

Creates a new sprint contract and notifies the Team Lead.

### Steps

1. **Generate contract ID**
   - Format: `CONTRACT-<YYYYMMDD>-<HHMMSS>`
   - Example: `CONTRACT-20260328-103045`

2. **Prompt for acceptance criteria**
   - Ask the user to provide the acceptance criteria (one per line)
   - If called from Orchestrator context, the Orchestrator defines the criteria based on the task

3. **Create the contracts directory if needed**
   ```bash
   mkdir -p .claude/messages/contracts/completed
   ```

4. **Write the contract file**
   Path: `.claude/messages/contracts/<contract-id>.md`

   ```markdown
   ---
   contract_id: CONTRACT-20260328-103045
   task: <task description>
   team_lead: <team-lead>
   created_at: 2026-03-28T10-30-45
   deadline: (set by Orchestrator or left blank)
   status: active
   ---

   ## Task

   <task description>

   ## Acceptance Criteria

   - [ ] <criterion 1>
   - [ ] <criterion 2>
   - [ ] <criterion 3>

   ## Completion Notes

   (filled in by Team Lead when completing)
   ```

5. **Notify the Team Lead**
   Write to the Team Lead's inbox:
   ```bash
   TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")
   cat > ".claude/messages/inbox/<team-lead>/${TIMESTAMP}_from-orchestrator.md" << 'EOF'
   Sprint contract created: CONTRACT-<id>

   Please read .claude/messages/contracts/CONTRACT-<id>.md, confirm the acceptance criteria,
   and begin implementation. You are responsible for this contract.
   EOF
   ```

6. **Output confirmation**
   ```
   ✅ Sprint contract created
     Contract ID : CONTRACT-20260328-103045
     Team Lead   : team-alpha-lead
     Task        : <task description>
     Criteria    : 4 items
     File        : .claude/messages/contracts/CONTRACT-20260328-103045.md
   ```

---

## /devteam:contract list

Lists all sprint contracts, optionally filtered by status.

### Steps

1. Scan `.claude/messages/contracts/` for `.md` files
2. Parse the frontmatter of each file to extract: contract_id, task, team_lead, status, created_at
3. Display as a table

### Output example

```
📋 Sprint Contracts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTRACT-20260328-103045  active    team-alpha-lead  API /api/v1/users implementation
CONTRACT-20260327-090000  completed team-beta-lead   User authentication module
CONTRACT-20260326-140000  blocked   team-alpha-lead  Database migration

Total: 3 (active: 1, completed: 1, blocked: 1)
```

---

## /devteam:contract complete

Marks a sprint contract as completed. Run by the Team Lead after the Evaluator confirms all criteria pass.

### Steps

1. **Verify the contract exists**
   ```bash
   ls .claude/messages/contracts/<contract-id>.md
   ```

2. **Update the contract file**
   - Set `status: completed` in the frontmatter
   - Set `completed_at: <current ISO timestamp>`
   - Check off all criteria as `[x]`
   - Append completion notes if provided

3. **Move to completed directory**
   ```bash
   mv .claude/messages/contracts/<contract-id>.md \
      .claude/messages/contracts/completed/<contract-id>.md
   ```

4. **Notify the Orchestrator**
   ```bash
   TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")
   cat > ".claude/messages/inbox/orchestrator/${TIMESTAMP}_from-<team-lead>.md" << 'EOF'
   Sprint contract completed: CONTRACT-<id>
   Task: <task description>
   All acceptance criteria have been verified and passed.
   EOF
   ```

5. **Output confirmation**
   ```
   ✅ Contract completed
     Contract ID : CONTRACT-20260328-103045
     Archived to : .claude/messages/contracts/completed/CONTRACT-20260328-103045.md
   ```

---

## /devteam:contract report

Generates a sprint summary report from all completed contracts.

### Steps

1. Scan `.claude/messages/contracts/completed/` for `.md` files
2. Parse each file's frontmatter and criteria
3. Generate a Markdown report summarizing completed work

### Output example

```
📊 Sprint Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Completed contracts: 2

CONTRACT-20260327-090000
  Team Lead : team-beta-lead
  Task      : User authentication module
  Completed : 2026-03-27T15-30-00
  Criteria  : 5/5 passed

CONTRACT-20260326-140000
  Team Lead : team-alpha-lead
  Task      : Database migration
  Completed : 2026-03-26T18-00-00
  Criteria  : 3/3 passed
```

---

## Error cases

```
❌ Error: team-lead 'invalid-agent' not found. Run /devteam:start first.
❌ Error: contract 'CONTRACT-XXXX' not found.
❌ Error: no completed contracts found.
```
