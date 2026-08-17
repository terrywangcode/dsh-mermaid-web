# Security policy

Please do not report suspected vulnerabilities in a public issue. Use GitHub's private vulnerability reporting for this repository instead.

The plugin renders assistant-provided Mermaid source in the browser. Security-sensitive changes must preserve Mermaid strict security mode, disabled HTML flowchart labels, controlled error rendering, and reversible plugin-owned DOM mutations.
