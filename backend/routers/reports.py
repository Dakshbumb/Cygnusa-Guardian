"""
Reports Router

Generates hiring decisions, exports reports as HTML, and manages
shareable report links.
Endpoints:
  POST   /api/assessment/generate-report/{id}  - Generate final AI decision
  GET    /api/report/export/{id}               - Export as downloadable HTML
  POST   /api/report/share/{id}                - Create shareable link
  GET    /api/report/shared/{token}            - View shared report (public)
  DELETE /api/report/share/{token}             - Revoke share link
"""

import io
import json
import uuid
import logging
import traceback
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models import IntegrityEvidence, FinalDecision
from dependencies import (
    db, decision_engine, active_sessions, share_tokens,
    add_decision_node,
)

logger = logging.getLogger("cygnusa-api")

router = APIRouter(tags=["Reports"])


# -------------------------------------------------------- Generate Report ---

@router.post("/api/assessment/generate-report/{candidate_id}")
async def generate_report(candidate_id: str):
    """Generate the final hiring decision with full explainability.

    This is the core "glass-box" feature: the decision engine aggregates
    all evidence (resume, coding, MCQ, psychometric, integrity,
    keystroke) and produces an outcome with transparent reasoning.
    """
    try:
        candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        # Build integrity evidence
        try:
            integrity_events = db.get_integrity_logs(candidate_id)
            severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
            severity_score = sum(severity_weights.get(e.severity, 1) for e in integrity_events)

            trustworthiness = "High" if severity_score == 0 else ("Medium" if severity_score < 5 else "Low")

            integrity_evidence = IntegrityEvidence(
                total_violations=len(integrity_events),
                events=integrity_events,
                severity_score=severity_score,
                trustworthiness_rating=trustworthiness,
            )
        except Exception as e:
            logger.error(f"Integrity evidence build failed: {e}")
            integrity_evidence = IntegrityEvidence(
                total_violations=0, events=[],
                severity_score=0, trustworthiness_rating="Unknown (Recovery Mode)",
            )

        # Generate decision
        decision = None
        try:
            decision = decision_engine.generate_decision(
                candidate_id=candidate_id,
                candidate_name=candidate.name,
                resume_evidence=candidate.resume_evidence,
                code_evidence=candidate.code_evidence,
                mcq_evidence=candidate.mcq_evidence,
                psychometric_evidence=candidate.psychometric_evidence,
                integrity_evidence=integrity_evidence,
                text_evidence=candidate.text_answer_evidence,
                keystroke_evidence=candidate.keystroke_evidence,
            )
        except Exception as e:
            logger.error(f"Decision generation failed: {e}\n{traceback.format_exc()}")
            fallback_data = decision_engine._generate_fallback_decision(
                {
                    "resume": candidate.resume_evidence.model_dump() if candidate.resume_evidence else {},
                    "coding": {"avg_pass_rate": 0},
                    "integrity": {"total_violations": 0},
                },
                candidate_id=candidate_id,
            )
            decision = FinalDecision(**fallback_data)

        # Persist
        candidate.integrity_evidence = integrity_evidence
        candidate.final_decision = decision
        candidate.status = "completed"
        candidate.completed_at = datetime.utcnow().isoformat()

        try:
            add_decision_node(
                candidate_id=candidate_id,
                node_type="FINAL",
                title=f"Forensic Verdict: {decision.outcome}",
                description=f"AI concluded {decision.outcome}. {decision.reasoning[0] if decision.reasoning else 'N/A'}",
                impact="positive" if decision.outcome == "HIRE" else "neutral",
            )
        except Exception as node_err:
            logger.warning(f"Decision node creation failed: {node_err}")

        db.save_candidate(candidate)
        active_sessions[candidate_id] = candidate

        return {"success": True, "decision": decision.model_dump(), "message": f"Decision generated: {decision.outcome}"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report generation critical error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {e}")


# -------------------------------------------------------- Export HTML ---

@router.get("/api/report/export/{candidate_id}")
async def export_report_pdf(candidate_id: str):
    """Export a candidate's forensic report as a downloadable HTML document.

    The generated HTML includes Chart.js visualizations (cognitive radar,
    integrity bar chart, evidentiary mapping) and is optimized for print.
    """
    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if not candidate.final_decision:
        raise HTTPException(status_code=400, detail="Report not yet generated")

    decision = candidate.final_decision
    evidence = decision.evidence_summary or {}

    # Safely convert cognitive_profile
    raw_cognitive = decision.cognitive_profile
    if raw_cognitive is None:
        cognitive = {}
    elif hasattr(raw_cognitive, "model_dump"):
        cognitive = raw_cognitive.model_dump()
    elif hasattr(raw_cognitive, "dict"):
        cognitive = raw_cognitive.dict()
    elif isinstance(raw_cognitive, dict):
        cognitive = raw_cognitive
    else:
        cognitive = {}

    integrity_logs = db.get_integrity_logs(candidate_id)

    # Build chart data
    chart_data = _build_chart_data(cognitive, integrity_logs, decision, evidence)

    # Format completion date
    completion_date = candidate.completed_at or candidate.created_at
    try:
        formatted_date = datetime.fromisoformat(completion_date).strftime("%B %d, %Y at %H:%M")
    except Exception:
        formatted_date = completion_date

    html_content = _render_report_html(candidate, decision, cognitive, integrity_logs, chart_data, formatted_date)

    return StreamingResponse(
        io.StringIO(html_content),
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=cygnusa_report_{candidate_id}.html"},
    )


# -------------------------------------------------------- Share Links ---

@router.post("/api/report/share/{candidate_id}")
async def create_share_link(candidate_id: str, expires_hours: int = 72):
    """Generate a time-limited shareable link for a candidate's report."""
    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if not candidate.final_decision:
        raise HTTPException(status_code=400, detail="Report not yet generated")

    share_token = f"share_{uuid.uuid4().hex[:12]}"
    expires_at = (datetime.now() + timedelta(hours=expires_hours)).isoformat()

    share_tokens[share_token] = {
        "candidate_id": candidate_id,
        "expires_at": expires_at,
        "created_at": datetime.now().isoformat(),
    }

    return {
        "success": True,
        "share_token": share_token,
        "expires_at": expires_at,
        "share_url": f"/shared/{share_token}",
        "message": f"Link expires in {expires_hours} hours",
    }


@router.get("/api/report/shared/{share_token}")
async def get_shared_report(share_token: str):
    """View a shared report (public endpoint, no auth required)."""
    if share_token not in share_tokens:
        raise HTTPException(status_code=404, detail="Invalid or expired share link")

    token_data = share_tokens[share_token]

    if datetime.now() > datetime.fromisoformat(token_data["expires_at"]):
        del share_tokens[share_token]
        raise HTTPException(status_code=410, detail="This share link has expired")

    candidate = db.get_candidate(token_data["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    decision = candidate.final_decision
    if not decision:
        raise HTTPException(status_code=400, detail="Report not available")

    return {
        "candidate": {"name": candidate.name, "job_title": candidate.job_title, "completed_at": candidate.completed_at},
        "decision": {
            "outcome": decision.outcome, "confidence": decision.confidence,
            "reasoning": decision.reasoning, "role_fit": decision.role_fit,
            "next_steps": decision.next_steps,
        },
        "evidence_summary": decision.evidence_summary,
        "shared_at": token_data["created_at"],
        "expires_at": token_data["expires_at"],
    }


@router.delete("/api/report/share/{share_token}")
async def revoke_share_link(share_token: str):
    """Revoke a shareable link before it naturally expires."""
    if share_token not in share_tokens:
        raise HTTPException(status_code=404, detail="Share link not found")

    del share_tokens[share_token]
    logger.info(f"Revoked share link: {share_token}")
    return {"success": True, "message": "Share link revoked"}


# ============================================================
# Private helpers
# ============================================================

def _build_chart_data(cognitive: dict, integrity_logs, decision, evidence: dict) -> dict:
    """Aggregate numeric data for Chart.js visualizations."""
    # Integrity breakdown
    violation_counts: dict = {}
    for log in integrity_logs:
        try:
            etype_raw = log.event_type if hasattr(log, "event_type") else log.get("event_type", "unknown")
        except Exception:
            etype_raw = "unknown"
        etype = str(etype_raw).replace("_", " ").title()
        violation_counts[etype] = violation_counts.get(etype, 0) + 1

    # Cognitive radar
    cognitive_labels, cognitive_values = [], []
    if cognitive and "cognitive_scores" in cognitive:
        try:
            for trait, score in cognitive["cognitive_scores"].items():
                trait_str = str(trait) if not isinstance(trait, dict) else "unknown"
                if isinstance(score, dict):
                    score_val = float(score.get("score", score.get("value", 5.0)))
                else:
                    score_val = float(score) if score is not None else 0.0
                cognitive_labels.append(trait_str.title())
                cognitive_values.append(score_val)
        except Exception:
            cognitive_labels = ["Abstraction", "Speed", "Precision", "Creativity"]
            cognitive_values = [5, 5, 5, 5]
    else:
        cognitive_labels = ["Abstraction", "Speed", "Precision", "Creativity"]
        cognitive_values = [0, 0, 0, 0]

    # Evidentiary mapping
    mapping = decision.evidentiary_mapping or {}
    mapping_labels, mapping_values = [], []
    impact_weight = {"primary_driver": 100, "supporting": 60, "negative": 30, "neutral": 10, "none": 0}
    try:
        for section, impact in mapping.items():
            section_str = str(section) if not isinstance(section, dict) else "unknown_section"
            mapping_labels.append(section_str.title())
            safe_impact = impact
            if isinstance(impact, dict):
                safe_impact = impact.get("impact", impact.get("value", "neutral"))
            mapping_values.append(impact_weight.get(str(safe_impact).lower(), 10))
    except Exception:
        mapping_labels, mapping_values = [], []

    # Score KPIs
    def get_val(path: str, default=0):
        parts = path.split(".")
        curr = evidence
        for p in parts:
            if isinstance(curr, dict):
                curr = curr.get(p)
            else:
                return default
        return curr if curr is not None else default

    return {
        "integrity_labels": list(violation_counts.keys()),
        "integrity_data": list(violation_counts.values()),
        "cognitive_labels": cognitive_labels,
        "cognitive_values": cognitive_values,
        "mapping_labels": mapping_labels,
        "mapping_values": mapping_values,
        "resume_score": get_val("resume.match_score", 0),
        "coding_score": get_val("coding.avg_pass_rate", 0),
        "mcq_score": get_val("mcqs.pass_rate", 0),
    }


def _render_report_html(candidate, decision, cognitive, integrity_logs, cd, formatted_date) -> str:
    """Build the full HTML document for the forensic assessment report."""
    resume_score = cd["resume_score"]
    coding_score = cd["coding_score"]
    mcq_score = cd["mcq_score"]

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forensic Assessment Report - {candidate.name}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-dark: #09090b;
            --surface: #ffffff;
            --surface-muted: #f8fafc;
            --primary: #2563eb;
            --secondary: #6366f1;
            --accent: #8b5cf6;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
        }}

        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Plus Jakarta Sans', sans-serif; background: var(--surface-muted); color: var(--text-main); line-height: 1.6; }}

        .page {{ max-width: 1000px; margin: 2rem auto; background: var(--surface); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.05); border-radius: 24px; overflow: hidden; border: 1px solid var(--border); }}

        header {{ background: var(--bg-dark); color: white; padding: 4rem 3rem; position: relative; }}
        .brand-logo {{ display: flex; align-items: center; gap: 1rem; margin-bottom: 3rem; }}
        .brand-logo svg {{ width: 32px; height: 32px; color: var(--primary); }}
        .brand-name {{ font-weight: 800; font-size: 1.5rem; letter-spacing: -0.02em; }}
        .hero-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }}
        .candidate-info h1 {{ font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.03em; }}
        .candidate-info .role {{ color: #94a3b8; font-weight: 500; font-size: 1.125rem; }}
        .status-badge {{ background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 16px; display: flex; flex-direction: column; gap: 0.5rem; }}
        .status-label {{ font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-weight: 700; }}
        .status-value {{ font-size: 1.25rem; font-weight: 700; color: white; }}

        main {{ padding: 3rem; }}
        .section {{ margin-bottom: 4rem; }}
        .section-header {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }}
        .section-title {{ font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }}

        .chart-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }}
        .chart-card {{ background: var(--surface-muted); padding: 2rem; border-radius: 20px; border: 1px solid var(--border); }}
        .chart-card h4 {{ margin-bottom: 1.5rem; font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }}

        .verdict-banner {{ display: grid; grid-template-columns: 240px 1fr; gap: 2.5rem; background: #f1f5f9; padding: 2.5rem; border-radius: 24px; margin-bottom: 3rem; align-items: center; }}
        .outcome-badge {{ padding: 1rem; border-radius: 16px; text-align: center; font-weight: 800; font-size: 1.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }}
        .outcome-HIRE {{ background: var(--success); color: white; }}
        .outcome-NO_HIRE {{ background: var(--danger); color: white; }}
        .outcome-CONDITIONAL {{ background: var(--warning); color: white; }}
        .rationale-text {{ font-size: 1rem; color: var(--text-main); font-weight: 500; }}

        .kpi-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 3rem; }}
        .kpi-card {{ background: white; border: 1px solid var(--border); padding: 1.5rem; border-radius: 16px; text-align: center; }}
        .kpi-card .label {{ font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem; }}
        .kpi-card .value {{ font-size: 1.75rem; font-weight: 800; }}

        .log-table {{ width: 100%; border-collapse: collapse; font-size: 0.875rem; }}
        .log-table th {{ text-align: left; padding: 1rem; color: var(--text-muted); border-bottom: 2px solid var(--border); }}
        .log-table td {{ padding: 1rem; border-bottom: 1px solid var(--border); }}
        .severity-dot {{ display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.5rem; }}
        .dot-high {{ background: var(--danger); }}
        .dot-medium {{ background: var(--warning); }}
        .dot-low {{ background: var(--success); }}

        footer {{ background: var(--surface-muted); padding: 3rem; text-align: center; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.875rem; }}

        @media print {{
            body {{ background: white; }}
            .page {{ box-shadow: none; margin: 0; max-width: 100%; border: none; }}
            header {{ -webkit-print-color-adjust: exact; }}
        }}
    </style>
</head>
<body>
    <div class="page">
        <header>
            <div class="brand-logo">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>
                <span class="brand-name">CYGNUSA GUARDIAN</span>
            </div>
            <div class="hero-grid">
                <div class="candidate-info">
                    <p class="status-label" style="color: var(--primary)">Professional Assessment Export</p>
                    <h1>{candidate.name}</h1>
                    <p class="role">{candidate.job_title} &bull; Forensic Report</p>
                </div>
                <div class="status-badge">
                    <div class="status-label">Report Integrity Signature</div>
                    <div class="status-value">{formatted_date}</div>
                    <div style="font-family: 'JetBrains Mono'; font-size: 10px; color: #475569; margin-top: 4px;">SIGNATURE: {candidate.id[:12].upper()}-VERIFIED</div>
                </div>
            </div>
        </header>

        <main>
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Forensic Verdict Dashboard</h2>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">CONFIDENCE: {decision.confidence.upper()}</span>
                </div>

                <div class="verdict-banner">
                    <div class="outcome-badge outcome-{decision.outcome}">{decision.outcome}</div>
                    <div class="rationale-text">
                        <p style="margin-bottom: 1rem;"><strong>AI Reasoning Trace:</strong> {decision.reasoning[0]}</p>
                        <div style="display: flex; gap: 1rem;">
                            <div style="flex: 1; padding: 1rem; background: rgba(255,255,255,0.5); border-radius: 12px; font-size: 0.8125rem;"><strong>Role Fit:</strong> {decision.role_fit}</div>
                            <div style="flex: 1; padding: 1rem; background: rgba(255,255,255,0.5); border-radius: 12px; font-size: 0.8125rem;"><strong>Next Action:</strong> {decision.next_steps}</div>
                        </div>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card"><div class="label">Resume Match</div><div class="value">{resume_score:.1f}%</div></div>
                    <div class="kpi-card"><div class="label">Coding Score</div><div class="value">{coding_score:.1f}%</div></div>
                    <div class="kpi-card"><div class="label">MCQ Performance</div><div class="value">{mcq_score:.1f}%</div></div>
                    <div class="kpi-card"><div class="label">Integrity</div><div class="value" style="color: { 'var(--success)' if len(integrity_logs) < 5 else 'var(--danger)' }">{ 'PASSED' if len(integrity_logs) < 5 else 'FLAGGED' }</div></div>
                </div>
            </div>

            <div class="section">
                <div class="section-header"><h2 class="section-title">Visual Intelligence Assets</h2></div>
                <div class="chart-grid">
                    <div class="chart-card">
                        <h4>Cognitive Architecture Profile</h4>
                        <canvas id="cognitiveRadar"></canvas>
                        <p style="font-size: 11px; color: var(--text-muted); margin-top: 1rem; text-align: center;">Archetype: <strong>{cognitive.get('primary_style', 'N/A').replace('_', ' ') if isinstance(cognitive.get('primary_style'), str) else 'N/A'}</strong></p>
                    </div>
                    <div class="chart-card">
                        <h4>Integrity Violation Breakdown</h4>
                        <canvas id="integrityBar"></canvas>
                    </div>
                </div>
                <div class="chart-card" style="margin-bottom: 2rem;">
                    <h4>Evidentiary Mapping (AI Drivers)</h4>
                    <canvas id="mappingChart" height="100"></canvas>
                </div>
            </div>

            <div class="section">
                <div class="section-header"><h2 class="section-title">Detailed Forensic Appendix</h2></div>
                {_render_integrity_table(integrity_logs)}
            </div>
        </main>

        <footer>
            <p><strong>Cygnusa Guardian Forensic Protocol v4.2</strong> &bull; Data sensitivity: <strong>RESTRICTED_HR</strong></p>
            <p style="margin-top: 0.5rem; opacity: 0.6;">Automated decisions are cross-referenced with behavioral biometric DNA. Forensic ID: {candidate.id}</p>
        </footer>
    </div>

    <script>
        new Chart(document.getElementById('cognitiveRadar'), {{
            type: 'radar',
            data: {{ labels: {json.dumps(cd['cognitive_labels'])}, datasets: [{{ label: 'Score', data: {json.dumps(cd['cognitive_values'])}, fill: true, backgroundColor: 'rgba(99,102,241,0.2)', borderColor: 'rgb(99,102,241)', pointBackgroundColor: 'rgb(99,102,241)', pointBorderColor: '#fff' }}] }},
            options: {{ scales: {{ r: {{ min: 0, max: 10, ticks: {{ display: false }} }} }}, plugins: {{ legend: {{ display: false }} }} }}
        }});

        new Chart(document.getElementById('integrityBar'), {{
            type: 'bar',
            data: {{ labels: {json.dumps(cd['integrity_labels'])}, datasets: [{{ label: 'Occurrences', data: {json.dumps(cd['integrity_data'])}, backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 8 }}] }},
            options: {{ indexAxis: 'y', scales: {{ x: {{ beginAtZero: true, ticks: {{ stepSize: 1 }} }} }}, plugins: {{ legend: {{ display: false }} }} }}
        }});

        new Chart(document.getElementById('mappingChart'), {{
            type: 'bar',
            data: {{ labels: {json.dumps(cd['mapping_labels'])}, datasets: [{{ label: 'Impact Weight', data: {json.dumps(cd['mapping_values'])}, backgroundColor: 'rgba(37,99,235,0.7)', borderRadius: 4 }}] }},
            options: {{ indexAxis: 'y', scales: {{ x: {{ display: false, max: 100 }} }}, plugins: {{ legend: {{ display: false }} }} }}
        }});
    </script>
</body>
</html>"""
    return html_content


def _render_integrity_table(integrity_logs) -> str:
    """Render the integrity log table or a clean-pass message."""
    if not integrity_logs:
        return '<p style="text-align: center; color: var(--success); padding: 2rem; background: #ecfdf5; border-radius: 12px; font-weight: 600;">Zero integrity anomalies detected during entire session.</p>'

    rows = ""
    for log in integrity_logs:
        ts = log.timestamp.split("T")[1][:8] if "T" in log.timestamp else log.timestamp
        etype = log.event_type.replace("_", " ").title()
        rows += f'<tr><td>{ts}</td><td style="font-weight: 600;">{etype}</td><td><span class="severity-dot dot-{log.severity}"></span>{log.severity.upper()}</td><td style="color: var(--text-muted); font-size: 12px;">{log.context or "N/A"}</td></tr>'

    return f"""<table class="log-table">
    <thead><tr><th>Time</th><th>Incident Category</th><th>Severity</th><th>Contextual Data</th></tr></thead>
    <tbody>{rows}</tbody>
</table>"""
