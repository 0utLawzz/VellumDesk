import type { DocumentTemplate } from '../types/document';

export const BUILT_IN_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tpl_msa_enterprise',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Master Services Agreement (MSA)',
    category: 'contract',
    description:
      'Comprehensive commercial B2B services agreement covering deliverables, IP assignment, payment schedules, SLA remedies, and mutual liability caps.',
    tone: 'formal_legal',
    jurisdiction: 'State of Delaware, United States',
    variables: ['Client_Entity', 'Provider_Entity', 'Effective_Date', 'Contract_Value', 'Payment_Terms'],
    sections: [
      {
        id: 'msa_parties',
        title: '1. Parties, Recitals & Scope of Services',
        guidance: 'Identify legal entities, effective date, incorporation of Statements of Work, and performance standards.',
      },
      {
        id: 'msa_fees',
        title: '2. Compensation, Invoicing & Expenses',
        guidance: 'Specify total fee or rate structure, Net-30 invoicing, late fee interest, and pre-approved expenses.',
      },
      {
        id: 'msa_ip',
        title: '3. Intellectual Property & Work Product',
        guidance: 'Distinguish background IP retained by provider from client-owned deliverables upon full payment.',
      },
      {
        id: 'msa_conf',
        title: '4. Confidentiality & Data Protection',
        guidance: 'Define confidential information, standard of care, security controls, and survival period.',
      },
      {
        id: 'msa_indemnity',
        title: '5. Warranties, Indemnification & Liability Cap',
        guidance: 'Include 90-day conformance warranty, third-party IP indemnity, and 12-month fee liability cap.',
      },
      {
        id: 'msa_term',
        title: '6. Term, Termination & Governing Law',
        guidance: 'Set initial term, termination for cause/convenience notice periods, survival, and dispute venue.',
      },
    ],
  },
  {
    id: 'tpl_mutual_nda',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Mutual Non-Disclosure Agreement',
    category: 'contract',
    description:
      'Balanced bilateral confidentiality agreement for strategic partnerships, M&A diligence, and vendor evaluations.',
    tone: 'formal_legal',
    jurisdiction: 'State of New York, United States',
    variables: ['Disclosing_Party', 'Receiving_Party', 'Purpose', 'Effective_Date', 'Survival_Years'],
    sections: [
      {
        id: 'nda_def',
        title: '1. Purpose & Definition of Confidential Information',
        guidance: 'Describe the permitted business evaluation and breadth of technical, financial, and commercial disclosures.',
      },
      {
        id: 'nda_excl',
        title: '2. Exclusions from Confidential Information',
        guidance: 'Cover public domain, prior possession, independent development, and lawful third-party disclosures.',
      },
      {
        id: 'nda_oblig',
        title: '3. Non-Disclosure Obligations & Standard of Care',
        guidance: 'Require need-to-know access restrictions, representative binding, and prompt breach notification.',
      },
      {
        id: 'nda_compelled',
        title: '4. Compelled Legal Disclosure',
        guidance: 'Require advance written notice (where legally permitted) and cooperation on protective orders.',
      },
      {
        id: 'nda_term',
        title: '5. Term, Return of Materials & Equitable Relief',
        guidance: 'Specify agreement term, survival duration, destruction certification, and injunctive relief rights.',
      },
    ],
  },
  {
    id: 'tpl_saas_sla',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Enterprise SaaS Subscription & SLA',
    category: 'contract',
    description:
      'Cloud software licensing agreement with 99.95% uptime SLA commitments, SOC 2 security terms, and subscription renewal mechanics.',
    tone: 'commercial_balanced',
    jurisdiction: 'State of California, United States',
    variables: ['Customer_Name', 'Vendor_Name', 'Subscription_Term', 'Annual_Fee', 'Uptime_SLA'],
    sections: [
      {
        id: 'saas_grant',
        title: '1. Platform Access & Subscription Rights',
        guidance: 'Define authorized user seats, acceptable use restrictions, and affiliate access.',
      },
      {
        id: 'saas_sla',
        title: '2. Service Level Availability & Support Credits',
        guidance: 'Detail 99.95% monthly uptime commitment, maintenance windows, and tiered service credits.',
      },
      {
        id: 'saas_data',
        title: '3. Customer Data Ownership & Security Controls',
        guidance: 'Affirm customer ownership of all ingested data, encryption standards, and breach response timelines.',
      },
      {
        id: 'saas_fees',
        title: '4. Subscription Fees, Taxes & Renewal',
        guidance: 'State annual billing cadence, price cap on renewal, and non-payment suspension notice.',
      },
      {
        id: 'saas_liab',
        title: '5. Indemnification & Limitation of Liability',
        guidance: 'Outline IP infringement defense, excluded indirect damages, and super-cap for data breaches.',
      },
    ],
  },
  {
    id: 'tpl_exec_employment',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Executive Employment Agreement',
    category: 'contract',
    description:
      'C-suite and VP employment contract covering base salary, performance bonus, equity vesting acceleration, and severance terms.',
    tone: 'formal_legal',
    jurisdiction: 'State of Delaware, United States',
    variables: ['Company_Name', 'Executive_Name', 'Role_Title', 'Base_Salary', 'Start_Date'],
    sections: [
      {
        id: 'emp_role',
        title: '1. Position, Duties & Reporting Structure',
        guidance: 'Specify executive title, board/CEO reporting line, full-time devotion, and permitted advisory boards.',
      },
      {
        id: 'emp_comp',
        title: '2. Base Salary, Target Bonus & Equity Grant',
        guidance: 'Detail annual base salary, MBO bonus percentage, equity vesting schedule, and benefit eligibility.',
      },
      {
        id: 'emp_term',
        title: '3. Termination, Good Reason & Severance',
        guidance: 'Define Cause, Good Reason, severance continuation, COBRA coverage, and Change-in-Control acceleration.',
      },
      {
        id: 'emp_cov',
        title: '4. Confidentiality & Post-Termination Covenants',
        guidance: 'Include proprietary inventions assignment, non-solicitation, and non-disparagement clauses.',
      },
    ],
  },
  {
    id: 'tpl_qbr_board',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Quarterly Board Performance Report',
    category: 'report',
    description:
      'Executive board packet summarizing revenue velocity, unit economics, operational milestones, cash runway, and risk mitigations.',
    tone: 'boardroom_analytical',
    jurisdiction: 'Board of Directors & Executive Leadership',
    variables: ['Company_Name', 'Reporting_Quarter', 'ARR_Figure', 'Net_Retention', 'Executive_Sponsor'],
    sections: [
      {
        id: 'qbr_exec',
        title: '1. Executive Summary & Headline Performance',
        guidance: 'Synthesize quarter highlights, ARR/revenue attainment vs. plan, and strategic inflection points.',
      },
      {
        id: 'qbr_fin',
        title: '2. Financial Performance & Unit Economics',
        guidance: 'Analyze gross margin, CAC payback, net dollar retention, operating burn, and cash runway.',
      },
      {
        id: 'qbr_ops',
        title: '3. Product, Engineering & Commercial Execution',
        guidance: 'Highlight enterprise pipeline velocity, key customer wins, roadmap delivery, and hiring progress.',
      },
      {
        id: 'qbr_risk',
        title: '4. Key Risk Register & Mitigation Actions',
        guidance: 'Document top operational, macroeconomic, and competitive risks with owner-assigned mitigations.',
      },
      {
        id: 'qbr_plan',
        title: '5. Next-Quarter Priorities & Board Decisions',
        guidance: 'Outline top 3 OKRs for the coming quarter and explicit resolutions requested from the Board.',
      },
    ],
  },
  {
    id: 'tpl_market_feasibility',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Market Expansion Feasibility Study',
    category: 'report',
    description:
      'Structured commercial feasibility assessment covering market sizing, competitive moats, regulatory friction, and 3-year ROI.',
    tone: 'executive_concise',
    jurisdiction: 'Corporate Strategy & Investment Committee',
    variables: ['Target_Market', 'Product_Line', 'Estimated_TAM', 'Launch_Budget', 'Lead_Analyst'],
    sections: [
      {
        id: 'mkt_thesis',
        title: '1. Expansion Thesis & Strategic Rationale',
        guidance: 'State the commercial objective, target geography or segment, and alignment with core capabilities.',
      },
      {
        id: 'mkt_sizing',
        title: '2. Market Sizing (TAM / SAM / SOM) & Demand Drivers',
        guidance: 'Present bottom-up addressable market estimates, buyer persona urgency, and secular tailwinds.',
      },
      {
        id: 'mkt_comp',
        title: '3. Competitive Landscape & Differentiation',
        guidance: 'Compare incumbent strengths, pricing tiers, switching barriers, and defensible product advantages.',
      },
      {
        id: 'mkt_reg',
        title: '4. Regulatory, Localization & Operational Readiness',
        guidance: 'Identify licensing requirements, data residency rules, localization scope, and partner dependencies.',
      },
      {
        id: 'mkt_fin',
        title: '5. Financial Model, Payback & Go / No-Go Recommendation',
        guidance: 'Summarize investment outlay, 36-month contribution margin trajectory, and staged launch gates.',
      },
    ],
  },
  {
    id: 'tpl_ops_audit',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Annual Operational & Security Audit',
    category: 'report',
    description:
      'Formal governance, SOC 2 / ISO readiness, incident resilience, and internal control remediation report.',
    tone: 'executive_concise',
    jurisdiction: 'Audit Committee & Chief Information Security Officer',
    variables: ['Organization_Name', 'Audit_Period', 'Framework_Standard', 'Audit_Lead'],
    sections: [
      {
        id: 'aud_scope',
        title: '1. Audit Scope, Methodology & Control Framework',
        guidance: 'Define systems in scope, sampling window, compliance standards, and evidence collection methodology.',
      },
      {
        id: 'aud_posture',
        title: '2. Governance & Operational Resilience Assessment',
        guidance: 'Evaluate access controls, change management, disaster recovery drills, and SLA adherence.',
      },
      {
        id: 'aud_gaps',
        title: '3. Identified Control Gaps & Severity Classification',
        guidance: 'Detail high/medium/low findings, root causes, and potential operational exposure.',
      },
      {
        id: 'aud_rem',
        title: '4. Remediation Roadmap & Verification Sign-Off',
        guidance: 'Assign remediation owners, target completion dates, and verification criteria.',
      },
    ],
  },
  {
    id: 'tpl_investment_memo',
    ownerId: 'system',
    isBuiltIn: true,
    name: 'Strategic Investment & Acquisition Memo',
    category: 'report',
    description:
      'Institutional-grade deal memorandum covering valuation multiples, synergy capture, diligence findings, and integration plan.',
    tone: 'boardroom_analytical',
    jurisdiction: 'Investment Committee',
    variables: ['Target_Company', 'Proposed_Valuation', 'Deal_Structure', 'Sponsor_Partner'],
    sections: [
      {
        id: 'inv_exec',
        title: '1. Deal Summary & Investment Thesis',
        guidance: 'Summarize proposed transaction structure, implied valuation multiples, and core value creation levers.',
      },
      {
        id: 'inv_target',
        title: '2. Target Business Profile & Revenue Quality',
        guidance: 'Examine recurring revenue mix, customer concentration, cohort retention, and leadership bench.',
      },
      {
        id: 'inv_syn',
        title: '3. Strategic Synergies & Sensitivity Cases',
        guidance: 'Quantify cross-sell revenue synergies, cost rationalization, and downside/base/upside IRR.',
      },
      {
        id: 'inv_risk',
        title: '4. Diligence Risks & Closing Conditions',
        guidance: 'Highlight legal, technical debt, or cultural integration risks and pre-closing conditions precedent.',
      },
    ],
  },
];
