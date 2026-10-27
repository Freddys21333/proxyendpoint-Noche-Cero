# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary audience is the containment committee comparing policies under limited resources and uncertainty. Its job is to decide whom to vaccinate, when to intervene, and how many resources to use within an educational scenario.

Secondary audiences documented in the PRD are the mayor/judges evaluating impact and limitations, the demo operator changing scenarios during the five-minute surprise-outbreak exercise, and the technical team reproducing and explaining results.

## Product Purpose

Simulate a fictional zombie outbreak over a synthetic population inspired by Manta, then compare containment policies. Success means supporting an understandable, fair, reproducible comparison with explicit uncertainty and resource constraints.

This is an educational simulator. It does not predict real outbreaks or provide medical recommendations. Contact-layer names do not establish real risk for any neighborhood or institution.

## Positioning

The documented mechanism compares `none`, `random`, and `targeted` on the same synthetic population and outbreak. Vaccination policies receive equivalent resources and eligibility rules. Repeated experiments, seeds, configuration, and engine versions are intended to make comparisons reproducible. Superiority of `targeted` remains a hypothesis until measured; unfavorable outcomes must remain visible.

## Operating Context

The Spanish interface supports scenario configuration, contact-network exploration, and policy comparison. Contact layers represent households, schools, buses, markets, and neighborhoods without personal data or precise household geolocation.

The current React/TypeScript frontend includes editable controls, an illustrative network, example comparison curves, and a scripted temporal demo. Navigation separates Simulador, Comparación and Ayuda. The surprise-outbreak section is removed from the interface. Scenario inputs are independent of those illustrations. I-02 connects health/config and a real population preview from the form. I-03 draws the actual day-zero graph and initial cases, with layer filtering and person inspection. Before requesting preview an explicit demo remains; editing invalidates the real view without showing stale data. The preview has no invented timeline or vaccination. Comparison execution and experiment exports still require further UI integration.

## Capabilities and Constraints

- Preserve the confirmed educational scope, synthetic population, Spanish interface, reproducible policy comparisons, and explicit demo-data labeling.
- The intended scientific model is daily SEIR: susceptible (`S`), exposed (`E`), infectious (`I`), and recovered or immunized (`R`). Only susceptible nodes are eligible for vaccination.
- Intended experiment outputs include daily curves, aggregate metrics, uncertainty across replicas, and reproducibility metadata. These are requirements, not evidence of implemented results.
- Current downloads are UI configuration drafts, not canonical experiment requests or reproducible results. Consultar red validates inputs and requests a real backend preview; changing parameters invalidates the prior preview. The graph uses real preview data after querying; comparison curves remain explicit demo data until their integration.
- Keep epidemiological calculations out of the frontend; use the shared technical agreements for integration.
- AWS deployment is documented as a delivery objective; a public deployment and operational results are not established by this product record.
- PRO capabilities remain separate from the required base scope and must not be represented as available without verification.

## Brand Commitments

The interface language is Spanish. Naming is explicitly undecided: the existing interface uses Mantalab, while the project documentation uses Comité de Contención de Manta. Neither name nor their relationship is confirmed as the final product/scenario naming scheme.

## Evidence on Hand

- `PRD.md`: product scope, audiences, acceptance requirements, and educational limitations.
- `TRD.md` and `specs/agreements.md`: technical methodology and integration agreements.
- `frontend/README.md`: implemented demo behavior and its limits, with recorded verification notes.
- `frontend/src/App.tsx` and the frontend components and libraries: existing interface and illustrative behavior.

Documentation, illustrative curves, and scripted demo states do not prove scientific effectiveness, deployment, or completed backend integration. Do not fabricate experiment results, performance claims, or policy recommendations.

## Product Principles

1. Help the committee compare policies with understandable evidence and explicit uncertainty.
2. Preserve fair comparisons and reproducibility rather than selecting favorable scenarios.
3. Distinguish illustrative behavior, planned capabilities, and measured results at every stage.
4. Keep the synthetic, educational nature of the scenario clear.
5. Preserve Spanish terminology and access to state information beyond color alone.
