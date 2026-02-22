# intent.plan.json

## Shape
```json
{
  "intent_version": "2.0",
  "status": "pass|warn|blocked",
  "task": {
    "domain": "Messaging",
    "tags": ["intentional-cross-domain"],
    "source": "pr_header|issue_label|slash_command|inferred|unknown"
  },
  "actions_summary": {
    "modify_files": 0,
    "import_cross_domain": 0
  },
  "violations": [
    {
      "code": "CrossDomainTouch",
      "severity": "error|warn|info",
      "confidence": "high|medium|low",
      "evidence": {},
      "remediation": {
        "actions": [],
        "approved_interfaces": []
      },
      "bypassed": {
        "tag": "intentional-cross-domain",
        "approval_required": "tech-lead",
        "approved": false
      }
    }
  ]
}
```