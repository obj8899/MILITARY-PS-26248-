# After-action review selection rules

Key moments are selected locally from the current run's visible report feed and run log. The fixed rules are applied in this order:

1. First T1 report with a non-zero scripted delivery delay that was not dropped.
2. First T1 report marked dropped by its scripted delivery rule.
3. First delivered report listed as refuted in the scenario's AAR notes.
4. First submitted decision command.
5. First refuted report marked `Verify` or `Discard` by T1.
6. First logged branch consequence.

Rules that have no matching evidence are omitted; the reel does not invent events. Captions use report IDs, delivery outcomes, triage actions, and command/event details. The scenario truth note is only consulted in the AAR after the decision has been submitted.
