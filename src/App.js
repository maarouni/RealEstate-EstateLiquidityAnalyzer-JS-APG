import React, { useState, useMemo } from "react";

// ─── Access Control ───────────────────────────────────────────────────────────
const APP_PASSWORD = "Estate-Liquidity1!";
const USER_PINS = { masoud:"2025", aaron:"4286", tom:"8891", advisor1:"3317", advisor2:"5529" };
const PIN_TO_NAME = Object.fromEntries(Object.entries(USER_PINS).map(([n,p])=>[p,n]));

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:      "#0a1628",
  panel:   "#0f2040",
  card:    "#1a3a5c",
  cardLt:  "#1e4570",
  blue:    "#4472C4",
  blueLt:  "#6b9de8",
  gold:    "#C9A84C",
  goldLt:  "#F0D98C",
  white:   "#F5F7FA",
  muted:   "#8A9BB5",
  green:   "#7CFC00",
  greenDk: "#2ECC8A",
  red:     "#FF6B6B",
  orange:  "#FFD700",
  border:  "rgba(68,114,196,0.35)",
  grid:    "rgba(138,155,181,0.12)",
};

// ─── Calculations (mirrors calculations.py exactly) ───────────────────────────
function futureValue(principal, rate, years) {
  return principal * Math.pow(1 + rate, years);
}

function runEstateModel(inputs, includeInsurance, includeGifting) {
  const { currentRealEstate, currentDebt, otherAssets, liquidAssets,
    insuranceDB, reAppreciation, otherGrowth, years,
    exemption, taxRate, probateRate, giftingPct, flpDiscount, ilit } = inputs;

  const projRE = futureValue(currentRealEstate, reAppreciation, years);
  const projOther = futureValue(otherAssets, otherGrowth, years);
  const projGross = projRE + projOther;
  const projNet = Math.max(projGross - currentDebt, 0);

  // Gifting reduction (FLP two-step)
  let giftingReduction = 0;
  if (includeGifting) {
    const grossGift = projNet * Math.min(Math.max(giftingPct, 0), 1);
    giftingReduction = grossGift * (1 - Math.min(Math.max(flpDiscount, 0), 0.5));
  }

  // Taxable estate
  const insuranceInEstate = (includeInsurance && !ilit) ? insuranceDB : 0;
  const taxable = Math.max(projNet + insuranceInEstate - giftingReduction - exemption, 0);

  // Settlement costs
  const estTax = Math.max(taxable * taxRate, 0);
  const probate = Math.max(projNet * probateRate, 0);
  const totalCosts = estTax + probate;

  // Liquidity
  const insOffset = includeInsurance ? insuranceDB : 0;
  const availLiquidity = liquidAssets + insOffset;
  const shortfall = Math.max(totalCosts - availLiquidity, 0);

  // Legacy
  const estateAfterCosts = Math.max(projNet - totalCosts, 0);
  const legacy = includeGifting ? estateAfterCosts + giftingReduction : estateAfterCosts;

  return { projRE, projOther, projGross, projNet, giftingReduction,
    taxable, estTax, probate, totalCosts, availLiquidity, insOffset, shortfall, legacy };
}

function buildTimeSeries(inputs, includeInsurance, includeGifting, maxYears=30) {
  return Array.from({length: maxYears}, (_, i) => {
    const yr = i + 1;
    const r = runEstateModel({...inputs, years: yr}, includeInsurance, includeGifting);
    return { year: yr, projEstate: r.projNet, costs: r.totalCosts,
      legacy: r.legacy, shortfall: r.shortfall };
  });
}

function forcedSaleRisk(shortfall, projNet) {
  if (projNet <= 0) return "Unknown";
  const ratio = shortfall / projNet;
  if (ratio <= 0.05) return "Low";
  if (ratio <= 0.15) return "Moderate";
  return "High";
}

// ─── Gate Screen ──────────────────────────────────────────────────────────────
function GateScreen({ onAuth }) {
  const [step, setStep] = useState("password");
  const [pwd, setPwd] = useState("");
  const [pin, setPin] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [pinErr, setPinErr] = useState("");

  const iStyle = { width:"100%", boxSizing:"border-box", background:C.card,
    border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px",
    color:C.white, fontSize:15, marginBottom:10, outline:"none" };
  const bStyle = { width:"100%", padding:"13px", background:C.blue, border:"none",
    color:C.white, borderRadius:8, cursor:"pointer", fontSize:15, fontWeight:700,
    marginTop:4, boxSizing:"border-box" };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:380,background:C.panel,borderRadius:16,padding:"36px 32px",
        border:`1px solid ${C.border}`,boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:11,color:C.blue,letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>
            RealEstate-Analytics.ai
          </div>
          <div style={{fontSize:22,fontWeight:700,fontFamily:"Georgia,serif",color:C.white}}>
            🏛️ Estate Liquidity Analyzer
          </div>
          <div style={{fontSize:12,color:C.muted,marginTop:6}}>APG Workflow — FLP + ILIT Combined Strategy</div>
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>
            {step==="password"?"🔒 Enter access password":"🔑 Enter your PIN"}
          </div>
        </div>
        {step==="password" && (
          <form onSubmit={e=>{e.preventDefault();
            if(pwd===APP_PASSWORD){setStep("pin");setPwdErr("");}
            else setPwdErr("❌ Incorrect password.");}}>
            <input type="password" placeholder="Access password" value={pwd}
              onChange={e=>setPwd(e.target.value)} autoComplete="current-password" style={iStyle}/>
            {pwdErr && <div style={{color:C.red,fontSize:12,marginBottom:8}}>{pwdErr}</div>}
            <button type="submit" style={bStyle}>Continue →</button>
          </form>
        )}
        {step==="pin" && (
          <form onSubmit={e=>{e.preventDefault();
            const name=PIN_TO_NAME[pin.trim()];
            if(name) onAuth(name); else setPinErr("❌ Incorrect PIN.");}}>
            <input type="password" placeholder="Your PIN" value={pin}
              onChange={e=>setPin(e.target.value)} maxLength={4} inputMode="numeric" style={iStyle}/>
            {pinErr && <div style={{color:C.red,fontSize:12,marginBottom:8}}>{pinErr}</div>}
            <button type="submit" style={bStyle}>Access Analyzer →</button>
            <button type="button" onClick={()=>{setStep("password");setPwd("");setPin("");setPinErr("");}}
              style={{...bStyle,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,marginTop:8}}>
              ← Back</button>
          </form>
        )}
        <div style={{textAlign:"center",marginTop:20,fontSize:10,color:C.muted}}>
          Protected — NYL APG Advanced Planning | RealEstate-Analytics.ai
        </div>
      </div>
    </div>
  );
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
const Label = ({children, sub}) => (
  <div style={{marginBottom:3}}>
    <span style={{fontSize:11,color:C.muted}}>{children}</span>
    {sub && <span style={{fontSize:10,color:C.blue,marginLeft:6}}>{sub}</span>}
  </div>
);

function NumInput({label, value, onChange, min=0, max=999999999, step=50000, sub, prefix="$"}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  return (
    <div style={{marginBottom:12}}>
      <Label sub={sub}>{label}</Label>
      {editing ? (
        <input type="text" autoFocus value={raw}
          onChange={e=>setRaw(e.target.value)}
          onBlur={()=>{const v=parseFloat(raw.replace(/[$,%,\s]/g,""));
            if(!isNaN(v)) onChange(Math.min(max,Math.max(min,v)));
            setEditing(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){const v=parseFloat(raw.replace(/[$,%,\s]/g,""));
            if(!isNaN(v)) onChange(Math.min(max,Math.max(min,v)));setEditing(false);}
            if(e.key==="Escape")setEditing(false);}}
          style={{width:"100%",boxSizing:"border-box",background:C.card,
            border:`1px solid ${C.gold}`,borderRadius:6,padding:"7px 10px",
            color:C.white,fontSize:13,outline:"none"}}/>
      ) : (
        <div onClick={()=>{setEditing(true);setRaw(String(value));}}
          title="Click to edit"
          style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,
            padding:"7px 10px",fontSize:13,color:C.white,cursor:"text",
            display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.muted,fontSize:11}}>{prefix}</span>
          <span>{prefix==="$"?value.toLocaleString():value}</span>
        </div>
      )}
    </div>
  );
}

function SliderRow({label, value, min, max, step=0.001, display, onChange, sub}) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <Label sub={sub}>{label}</Label>
        <span style={{fontSize:12,fontWeight:700,color:C.goldLt}}>{display(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(parseFloat(e.target.value))}
        style={{width:"100%",accentColor:C.blue}}/>
    </div>
  );
}

function TextInput({label, value, onChange, placeholder}) {
  return (
    <div style={{marginBottom:12}}>
      <Label>{label}</Label>
      <input type="text" value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{width:"100%",boxSizing:"border-box",background:C.card,
          border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",
          color:C.white,fontSize:13,outline:"none"}}/>
    </div>
  );
}

function SelectInput({label, value, options, onChange}) {
  return (
    <div style={{marginBottom:12}}>
      <Label>{label}</Label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
          borderRadius:6,padding:"7px 10px",color:C.white,fontSize:13}}>
        {options.map(o=><option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Toggle({label, checked, onChange, help}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,
      background:C.card,borderRadius:8,padding:"10px 12px",border:`1px solid ${C.border}`}}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}
        style={{accentColor:C.blue,width:16,height:16,cursor:"pointer"}}/>
      <div>
        <div style={{fontSize:12,color:C.white,fontWeight:600}}>{label}</div>
        {help && <div style={{fontSize:10,color:C.muted,marginTop:2}}>{help}</div>}
      </div>
    </div>
  );
}

function MetricCard({label, value, color=C.white, sub}) {
  return (
    <div style={{background:C.card,borderRadius:10,padding:"14px 16px",
      border:`1px solid ${C.border}`,flex:"1 1 150px",textAlign:"center"}}>
      <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color,fontFamily:"Georgia,serif"}}>{value}</div>
      {sub && <div style={{fontSize:10,color:C.muted,marginTop:4}}>{sub}</div>}
    </div>
  );
}

function SectionHeader({children, caption}) {
  return (
    <div style={{borderLeft:`4px solid ${C.blue}`,paddingLeft:12,marginBottom:16,marginTop:24}}>
      <div style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:"Georgia,serif"}}>{children}</div>
      {caption && <div style={{fontSize:11,color:C.muted,marginTop:3}}>{caption}</div>}
    </div>
  );
}

// ─── Line Chart (SVG) ─────────────────────────────────────────────────────────
function LineChart({data, years}) {
  const W=700, H=280, PL=80, PR=20, PT=30, PB=40;
  const cW=W-PL-PR, cH=H-PT-PB;

  const allVals = data.flatMap(d=>[d.projEstate,d.costs,d.legacy,d.shortfall]);
  const maxV = Math.max(...allVals, 1);
  const xPx = i => PL + (i/(data.length-1))*cW;
  const yPx = v => PT + cH - (v/maxV)*cH;

  const lines = [
    {key:"projEstate", color:C.blue, label:"Projected Estate"},
    {key:"costs",      color:C.red,  label:"Settlement Costs", dash:"6,3"},
    {key:"legacy",     color:C.green,label:"Legacy to Heirs"},
    {key:"shortfall",  color:C.orange,label:"Liquidity Shortfall", dash:"3,3"},
  ];

  const fmt = v => v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${Math.round(v/1000)}K`:`$${Math.round(v)}`;
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {/* Legend */}
      {lines.map(({color,label,dash},i)=>(
        <g key={i} transform={`translate(${PL+i*165},8)`}>
          <line x1="0" y1="6" x2="18" y2="6" stroke={color} strokeWidth="2.5"
            strokeDasharray={dash||"none"}/>
          <text x="22" y="10" style={{fontSize:9,fill:C.muted}}>{label}</text>
        </g>
      ))}
      {/* Grid */}
      {Array.from({length:ticks+1},(_,i)=>(
        <line key={i} x1={PL} y1={PT+(i/ticks)*cH} x2={W-PR} y2={PT+(i/ticks)*cH}
          stroke={C.grid} strokeWidth="1" strokeDasharray="3,3"/>
      ))}
      {/* Y axis labels */}
      {Array.from({length:ticks+1},(_,i)=>{
        const v=((ticks-i)/ticks)*maxV;
        return <text key={i} x={PL-6} y={PT+(i/ticks)*cH+4} textAnchor="end"
          style={{fontSize:9,fill:C.muted}}>{fmt(v)}</text>;
      })}
      {/* X axis labels */}
      {[1,5,10,15,20,25,30].filter(y=>y<=data.length).map(y=>(
        <text key={y} x={xPx(y-1)} y={H-8} textAnchor="middle"
          style={{fontSize:9,fill:C.muted}}>Yr {y}</text>
      ))}
      {/* Vertical line at selected years */}
      <line x1={xPx(years-1)} y1={PT} x2={xPx(years-1)} y2={PT+cH}
        stroke={C.white} strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
      <text x={xPx(years-1)+4} y={PT+10} style={{fontSize:9,fill:C.white}}>Year {years}</text>
      {/* Lines */}
      {lines.map(({key,color,dash})=>{
        const pts = data.map((d,i)=>`${xPx(i)},${yPx(d[key])}`).join(" ");
        return <polyline key={key} points={pts} fill="none" stroke={color}
          strokeWidth="2" strokeDasharray={dash||"none"} strokeLinejoin="round"/>;
      })}
      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke={C.muted} strokeWidth="1"/>
      <line x1={PL} y1={PT+cH} x2={W-PR} y2={PT+cH} stroke={C.muted} strokeWidth="1"/>
      <text x={PL+cW/2} y={H-1} textAnchor="middle" style={{fontSize:9,fill:C.muted}}>Years</text>
    </svg>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function EstateApp({ userName }) {
  // Client info
  const [clientName,   setClientName]   = useState("");
  const [clientDOB,    setClientDOB]    = useState("");
  const [clientState,  setClientState]  = useState("");
  const [spouseName,   setSpouseName]   = useState("");
  const [spouseDOB,    setSpouseDOB]    = useState("");
  const [filingStatus, setFilingStatus] = useState("Single");
  const [agentName,    setAgentName]    = useState("Aaron Sanchez");
  const [agentCode,    setAgentCode]    = useState("233275");
  const [goName,       setGoName]       = useState("GSF");

  // APG Q16 — Assets
  const [reInvestments,   setReInvestments]   = useState(4000000);
  const [residence,       setResidence]       = useState(1500000);
  const [mktSecurities,   setMktSecurities]   = useState(500000);
  const [businessInt,     setBusinessInt]     = useState(0);
  const [otherInv,        setOtherInv]        = useState(0);
  const [cashEquiv,       setCashEquiv]       = useState(300000);
  const [antiques,        setAntiques]        = useState(0);
  const [personalProp,    setPersonalProp]    = useState(0);

  // APG Q17 — Retirement
  const [retirement,      setRetirement]      = useState(0);

  // APG Q18 — Liabilities
  const [mortgage,        setMortgage]        = useState(500000);
  const [otherDebts,      setOtherDebts]      = useState(0);

  // APG Q19/Q20 — Growth & Time
  const [reGrowth,        setReGrowth]        = useState(0.04);
  const [otherGrowth,     setOtherGrowth]     = useState(0.05);
  const [years,           setYears]           = useState(15);

  // APG Q21 — Insurance
  const [insuranceDB,     setInsuranceDB]     = useState(3000000);
  const [ilit,            setIlit]            = useState(true);

  // APG Q22/Q23 — Tax & Planning
  const [exemption,       setExemption]       = useState(15000000);
  const [taxRate,         setTaxRate]         = useState(0.40);
  const [probateRate,     setProbateRate]     = useState(0.01);
  const [giftingPct,      setGiftingPct]      = useState(0.20);
  const [flpDiscount,     setFlpDiscount]     = useState(0.30);

  // Toggles
  const [inclInsurance,   setInclInsurance]   = useState(true);
  const [inclGifting,     setInclGifting]     = useState(true);

  // Email
  const [clientEmail,     setClientEmail]     = useState("");
  const [apgEmail,        setApgEmail]        = useState("apg@newyorklife.com");

  // Active step
  const [activeStep,      setActiveStep]      = useState(1);

  // Computed totals
  const totalRE = reInvestments + residence;
  const otherAssetsTotal = mktSecurities + businessInt + otherInv + antiques + personalProp + retirement;
  const otherAssetsCombined = otherAssetsTotal;
  const totalLiabilities = mortgage + otherDebts;
  const totalAssetsQ16 = totalRE + otherAssetsTotal + cashEquiv;

  // Build inputs object
  const inputs = {
    currentRealEstate: totalRE,
    currentDebt: totalLiabilities,
    otherAssets: otherAssetsCombined,
    liquidAssets: cashEquiv,
    insuranceDB,
    reAppreciation: reGrowth,
    otherGrowth,
    years,
    exemption: filingStatus==="Married" ? exemption*2 : exemption,
    taxRate,
    probateRate,
    giftingPct,
    flpDiscount,
    ilit,
  };

  // Main results
  const results = useMemo(()=>runEstateModel(inputs, inclInsurance, inclGifting), 
    [totalRE, totalLiabilities, otherAssetsCombined, cashEquiv, insuranceDB,
     reGrowth, otherGrowth, years, exemption, filingStatus, taxRate, probateRate,
     giftingPct, flpDiscount, ilit, inclInsurance, inclGifting]);

  const risk = forcedSaleRisk(results.shortfall, results.projNet);
  const riskColor = risk==="Low"?C.greenDk:risk==="Moderate"?C.orange:C.red;

  // Scenario comparison
  const scenarios = useMemo(()=>[
    {name:"Current Planning",       ins:false, gift:false},
    {name:"Insurance Only",         ins:true,  gift:false},
    {name:"Gifting / FLP Only",     ins:false, gift:true},
    {name:"Insurance + FLP (Best)", ins:true,  gift:true},
  ].map(s=>{
    const r = runEstateModel(inputs, s.ins, s.gift);
    const rsk = forcedSaleRisk(r.shortfall, r.projNet);
    let outcome = "";
    if(s.name==="Current Planning") outcome="Significant liquidity exposure";
    else if(s.name==="Insurance Only") outcome="Improves liquidity position";
    else if(s.name==="Gifting / FLP Only") outcome = r.shortfall<=0?"Reduces estate and supports liquidity":"Reduces estate, but liquidity gap remains";
    else outcome = r.shortfall<=0?"Optimizes liquidity and legacy":"Best overall — gap materially reduced";
    return {...r, name:s.name, risk:rsk, outcome};
  }), [totalRE, totalLiabilities, otherAssetsCombined, cashEquiv, insuranceDB,
       reGrowth, otherGrowth, years, exemption, filingStatus, taxRate, probateRate,
       giftingPct, flpDiscount, ilit]);

  // Time series
  const timeSeries = useMemo(()=>buildTimeSeries(inputs, inclInsurance, inclGifting, 30),
    [totalRE, totalLiabilities, otherAssetsCombined, cashEquiv, insuranceDB,
     reGrowth, otherGrowth, exemption, filingStatus, taxRate, probateRate,
     giftingPct, flpDiscount, ilit, inclInsurance, inclGifting]);

  const fmt = v => "$"+Math.round(v).toLocaleString();
  const fmtPct = v => (v*100).toFixed(1)+"%";
  const today = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const clientDisplay = clientName || "Client";
  const recommendedPolicy = Math.max(results.shortfall + cashEquiv, 0);

  // Email body
  const emailBody = `Estate Liquidity Illustration Summary
Prepared by: ${agentName} | Agent Code: ${agentCode} | GO: ${goName}
Date: ${today}

CLIENT: ${clientDisplay}
State: ${clientState} | Status: ${filingStatus}

─── ASSET SUMMARY (APG Q16-Q23) ───
Real Estate (Investments + Residence): $${totalRE.toLocaleString()}
Other Assets:                          $${otherAssetsCombined.toLocaleString()}
Liquid Assets (Cash):                  $${cashEquiv.toLocaleString()}
Total Liabilities:                     $${totalLiabilities.toLocaleString()}
Life Insurance (Death Benefit):        $${insuranceDB.toLocaleString()}
Insurance Structure:                   ${ilit?"ILIT-held (outside taxable estate)":"Personally owned (in taxable estate)"}

─── ILLUSTRATION PARAMETERS ───
Growth Rate (RE / Other):    ${fmtPct(reGrowth)} / ${fmtPct(otherGrowth)}
Time Horizon:                ${years} years
Estate Tax Exemption:        $${(filingStatus==="Married"?exemption*2:exemption).toLocaleString()} (OBBBA 2026)
Estate Tax Rate:             ${fmtPct(taxRate)}
FLP Gifting:                 ${fmtPct(giftingPct)} gifted / ${fmtPct(flpDiscount)} valuation discount

─── ILLUSTRATION RESULTS ───
Projected Net Estate:        $${Math.round(results.projNet).toLocaleString()}
Taxable Estate:              $${Math.round(results.taxable).toLocaleString()}
Total Settlement Costs:      $${Math.round(results.totalCosts).toLocaleString()}
Available Liquidity:         $${Math.round(results.availLiquidity).toLocaleString()}
Liquidity Shortfall:         $${Math.round(results.shortfall).toLocaleString()}
Legacy to Heirs:             $${Math.round(results.legacy).toLocaleString()}
Forced Sale Risk:            ${risk}

─── RECOMMENDATION ───
${results.shortfall>0?`Minimum recommended ILIT-held policy: $${Math.round(recommendedPolicy).toLocaleString()}`:"Current structure fully funds the estate. No additional policy required."}

─── PLANNING COMPARISON ───
${"Scenario".padEnd(28)}${"Settlement Costs".padEnd(20)}${"Liquidity Shortfall".padEnd(22)}Legacy to Heirs
${scenarios.map(s=>`${s.name.padEnd(28)}$${Math.round(s.totalCosts).toLocaleString().padEnd(19)} $${Math.round(s.shortfall).toLocaleString().padEnd(21)} $${Math.round(s.legacy).toLocaleString()}`).join("\n")}

─── DISCLAIMER ───
This illustration is for educational and planning purposes only. Not legal, tax, or accounting advice.
All values are estimates based on inputs provided. Consult qualified estate planning attorneys,
CPAs, and insurance professionals before implementing any planning strategies.
Generated by RealEstate-Analytics.ai | ${today}`;

  const stepBtn = (n, label) => (
    <button onClick={()=>setActiveStep(n)}
      style={{padding:"10px 20px",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
        background:activeStep===n?C.blue:"transparent",
        color:activeStep===n?C.white:C.muted,
        borderBottom:activeStep===n?`3px solid ${C.blueLt}`:"3px solid transparent",
        borderRadius:activeStep===n?"6px 6px 0 0":"0"}}>
      {label}
    </button>
  );

  return (
    <div style={{fontFamily:"'Calibri','Segoe UI',sans-serif",background:C.bg,color:C.white,minHeight:"100vh"}}>

      {/* Header */}
      <div style={{background:C.panel,borderBottom:`3px solid ${C.blue}`,padding:"14px 24px",
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:10,color:C.blue,letterSpacing:3,textTransform:"uppercase"}}>RealEstate-Analytics.ai</div>
          <div style={{fontSize:19,fontWeight:700,fontFamily:"Georgia,serif"}}>
            🏛️ Estate Liquidity Analyzer — APG Workflow
          </div>
          <div style={{fontSize:11,color:C.muted}}>HNW Real Estate Investor — FLP + ILIT Combined Strategy | Aligned to NYL APG Questionnaire</div>
        </div>
        <div style={{fontSize:11,color:C.muted}}>👤 {userName.charAt(0).toUpperCase()+userName.slice(1)}</div>
      </div>

      {/* OBBBA Banner */}
      <div style={{background:"#1a3a5c",borderLeft:`4px solid ${C.blue}`,padding:"12px 24px",fontSize:13}}>
        ⚖️ <strong>2026 Tax Law — OBBBA:</strong> Federal estate tax exemption is{" "}
        <strong>$15,000,000 per individual ($30,000,000 married)</strong>, effective January 1, 2026.
        Signed July 4, 2025. 40% rate unchanged. All calculations reflect current 2026 law.
      </div>

      {/* Step tabs */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",gap:4}}>
        {stepBtn(1,"Step 1 — Client Profile")}
        {stepBtn(2,"Step 2 — Planning & Results")}
        {stepBtn(3,"Step 3 — Send Illustration")}
      </div>

      <div style={{padding:"24px",maxWidth:1200,margin:"0 auto"}}>

        {/* ── STEP 1 ── */}
        {activeStep===1 && <>
          <SectionHeader caption="Mapped to NYL APG Advanced Planning Questionnaire — Personal Planning (Q1, Q16–Q23)">
            Step 1 — Client Profile
          </SectionHeader>

          {/* Client & Agent Info */}
          <div style={{background:C.panel,borderRadius:10,padding:"16px 20px",
            border:`1px solid ${C.border}`,marginBottom:20}}>
            <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:14}}>
              📋 Client & Agent Information (APG Q1)
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
              <div>
                <TextInput label="Client Name (Q1)" value={clientName} onChange={setClientName} placeholder="e.g. John Smith"/>
                <TextInput label="Date of Birth (Q1)" value={clientDOB} onChange={setClientDOB} placeholder="MM/DD/YYYY"/>
                <TextInput label="State of Domicile (Q1)" value={clientState} onChange={setClientState} placeholder="e.g. CA"/>
              </div>
              <div>
                <TextInput label="Spouse Name (Q2)" value={spouseName} onChange={setSpouseName} placeholder="Optional"/>
                <TextInput label="Spouse DOB (Q2)" value={spouseDOB} onChange={setSpouseDOB} placeholder="MM/DD/YYYY"/>
                <SelectInput label="Filing Status" value={filingStatus}
                  options={["Single","Married","Widowed"]} onChange={setFilingStatus}/>
              </div>
              <div>
                <TextInput label="Agent Name" value={agentName} onChange={setAgentName} placeholder="Agent name"/>
                <TextInput label="Agent Code" value={agentCode} onChange={setAgentCode} placeholder=""/>
                <TextInput label="GO Name" value={goName} onChange={setGoName} placeholder=""/>
              </div>
            </div>
          </div>

          {/* APG Q16 — Assets */}
          <div style={{background:C.panel,borderRadius:10,padding:"16px 20px",
            border:`1px solid ${C.border}`,marginBottom:20}}>
            <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:4}}>
              APG Q16 — Assets (Market Value)
            </div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>
              Enter current market values. Growth rates are set in Step 2.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <NumInput label="Real Estate Investments ($) — Q16" value={reInvestments} onChange={setReInvestments}/>
                <NumInput label="Residence(s) ($) — Q16" value={residence} onChange={setResidence}/>
                <NumInput label="Marketable Securities ($) — Q16" value={mktSecurities} onChange={setMktSecurities} step={50000}/>
                <NumInput label="Business Interests ($) — Q16" value={businessInt} onChange={setBusinessInt} step={50000}/>
              </div>
              <div>
                <NumInput label="Other Investments ($) — Q16" value={otherInv} onChange={setOtherInv} step={50000}/>
                <NumInput label="Cash Equivalents / Liquid Assets ($) — Q16" value={cashEquiv} onChange={setCashEquiv} step={50000}/>
                <NumInput label="Antiques & Collectibles ($) — Q16" value={antiques} onChange={setAntiques} step={10000}/>
                <NumInput label="Personal Property & Autos ($) — Q16" value={personalProp} onChange={setPersonalProp} step={10000}/>
              </div>
            </div>
            <div style={{background:"#1a3a5c",borderRadius:7,padding:"10px 14px",fontSize:12,marginTop:8}}>
              Q16 Totals — RE (investments + residence): <strong>${totalRE.toLocaleString()}</strong> |{" "}
              Other assets: <strong>${otherAssetsTotal.toLocaleString()}</strong> |{" "}
              Liquid: <strong>${cashEquiv.toLocaleString()}</strong> |{" "}
              <strong>Total: ${totalAssetsQ16.toLocaleString()}</strong>
            </div>
          </div>

          {/* APG Q17 — Retirement */}
          <div style={{background:C.panel,borderRadius:10,padding:"16px 20px",
            border:`1px solid ${C.border}`,marginBottom:20}}>
            <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:8}}>
              APG Q17 — Retirement Accounts & Annuities
            </div>
            <NumInput label="Total Retirement Accounts (IRA, 401k, Annuities) ($) — Q17"
              value={retirement} onChange={setRetirement}/>
            <div style={{fontSize:10,color:C.muted}}>
              Include IRA, Roth IRA, SEP, 401(k), Annuities. Included in Other Assets for estate calculation.
            </div>
          </div>

          {/* APG Q18 — Liabilities */}
          <div style={{background:C.panel,borderRadius:10,padding:"16px 20px",
            border:`1px solid ${C.border}`,marginBottom:20}}>
            <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:8}}>APG Q18 — Liabilities</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <NumInput label="Mortgage / Loan Balance ($) — Q18" value={mortgage} onChange={setMortgage}/>
              <NumInput label="Other Debts ($) — Q18" value={otherDebts} onChange={setOtherDebts} step={10000}/>
            </div>
            <div style={{fontSize:12,color:C.muted}}>
              Total Liabilities: <strong style={{color:C.white}}>${totalLiabilities.toLocaleString()}</strong>
            </div>
          </div>

          <button onClick={()=>setActiveStep(2)}
            style={{padding:"12px 32px",background:C.blue,border:"none",color:C.white,
              borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:700}}>
            Continue to Step 2 →
          </button>
        </>}

        {/* ── STEP 2 ── */}
        {activeStep===2 && <>
          <SectionHeader caption="Growth assumptions, planning toggles, and estate model results">
            Step 2 — Planning Parameters & Results
          </SectionHeader>

          <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:20}}>

            {/* Left — Inputs */}
            <div>
              {/* APG Q19/Q20 */}
              <div style={{background:C.panel,borderRadius:10,padding:"16px",
                border:`1px solid ${C.border}`,marginBottom:16}}>
                <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:12}}>
                  APG Q19/Q20 — Growth Rate & Time Horizon
                </div>
                <SliderRow label="Real Estate Appreciation Rate (%)" value={reGrowth}
                  min={0} max={0.12} step={0.005} display={v=>(v*100).toFixed(1)+"%"}
                  onChange={setReGrowth}/>
                <SliderRow label="Other Asset Growth Rate (%)" value={otherGrowth}
                  min={0} max={0.15} step={0.005} display={v=>(v*100).toFixed(1)+"%"}
                  onChange={setOtherGrowth}/>
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <Label>Years Until Death</Label>
                    <span style={{fontSize:13,fontWeight:700,color:C.goldLt}}>{years} yrs</span>
                  </div>
                  <input type="range" min={1} max={40} step={1} value={years}
                    onChange={e=>setYears(parseInt(e.target.value))}
                    style={{width:"100%",accentColor:C.blue}}/>
                </div>
              </div>

              {/* APG Q21 — Insurance */}
              <div style={{background:C.panel,borderRadius:10,padding:"16px",
                border:`1px solid ${C.border}`,marginBottom:16}}>
                <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:12}}>
                  APG Q21 — Life Insurance
                </div>
                <NumInput label="Life Insurance Death Benefit ($)" value={insuranceDB} onChange={setInsuranceDB}/>
                <Toggle label="Insurance held in ILIT (outside taxable estate)" checked={ilit} onChange={setIlit}
                  help="ILIT = Irrevocable Life Insurance Trust. Excludes death benefit from taxable estate."/>
              </div>

              {/* APG Q22/Q23 */}
              <div style={{background:C.panel,borderRadius:10,padding:"16px",
                border:`1px solid ${C.border}`,marginBottom:16}}>
                <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:12}}>
                  APG Q22/Q23 — Tax & Planning Parameters
                </div>
                <NumInput label="Estate Tax Exemption ($)" value={exemption} onChange={setExemption}
                  sub={filingStatus==="Married"?"×2 for married = $"+(exemption*2).toLocaleString():"OBBBA 2026 default"}/>
                <SliderRow label="Estate Tax Rate (%)" value={taxRate}
                  min={0} max={0.60} step={0.01} display={v=>(v*100).toFixed(0)+"%"}
                  onChange={setTaxRate}/>
                <SliderRow label="Probate / Settlement Cost Rate (%)" value={probateRate}
                  min={0} max={0.05} step={0.001} display={v=>(v*100).toFixed(1)+"%"}
                  onChange={setProbateRate}/>
                <SliderRow label="Gifting % — FLP Transfer" value={giftingPct}
                  min={0} max={1} step={0.01} display={v=>(v*100).toFixed(0)+"%"}
                  onChange={setGiftingPct}/>
                <SliderRow label="FLP Valuation Discount (%)" value={flpDiscount}
                  min={0} max={0.50} step={0.01} display={v=>(v*100).toFixed(0)+"%"}
                  onChange={setFlpDiscount}
                  sub="Typically 20–40% for LP shares"/>
              </div>

              {/* Planning Toggles */}
              <div style={{background:C.panel,borderRadius:10,padding:"16px",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:12}}>
                  Planning Options
                </div>
                <Toggle label="Include insurance offset" checked={inclInsurance} onChange={setInclInsurance}/>
                <Toggle label="Include gifting / FLP planning reduction" checked={inclGifting} onChange={setInclGifting}
                  help="FLP = Family Limited Partnership. Valuation discount applied to gifted LP shares."/>
              </div>
            </div>

            {/* Right — Results */}
            <div>
              {/* Key metrics */}
              <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:16}}>
                <MetricCard label="Projected Net Estate" value={fmt(results.projNet)} color={C.blueLt}/>
                <MetricCard label="Taxable Estate" value={fmt(results.taxable)} color={C.white}/>
                <MetricCard label="Settlement Costs" value={fmt(results.totalCosts)} color={C.red}/>
                <MetricCard label="Insurance Offset" value={fmt(results.insOffset)} color={C.greenDk}/>
                <MetricCard label="Liquidity Shortfall" value={fmt(results.shortfall)}
                  color={results.shortfall>0?C.red:C.greenDk}/>
                <MetricCard label="Legacy to Heirs" value={fmt(results.legacy)} color={C.green}/>
                <MetricCard label="Forced Sale Risk" value={risk} color={riskColor}
                  sub={results.shortfall>0?`Recommended policy: ${fmt(recommendedPolicy)}`:"Estate fully funded"}/>
              </div>

              {/* Scenario comparison table */}
              <div style={{background:C.panel,borderRadius:10,padding:"16px",
                border:`1px solid ${C.border}`,marginBottom:16}}>
                <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:12}}>
                  📊 Planning Scenario Comparison
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:C.cardLt}}>
                        {["Scenario","Settlement Costs","Insurance Offset","Liquidity Shortfall","Legacy to Heirs","Risk","Outcome"].map(h=>(
                          <th key={h} style={{padding:"8px 10px",color:C.muted,
                            fontWeight:600,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((s,i)=>{
                        const rCol=s.risk==="Low"?C.greenDk:s.risk==="Moderate"?C.orange:C.red;
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${C.grid}`,
                            background:i%2===0?"transparent":"rgba(26,58,92,0.3)"}}>
                            <td style={{padding:"8px 10px",color:C.white,fontWeight:600}}>{s.name}</td>
                            <td style={{padding:"8px 10px",color:C.red}}>{fmt(s.totalCosts)}</td>
                            <td style={{padding:"8px 10px",color:C.greenDk}}>{fmt(s.insOffset)}</td>
                            <td style={{padding:"8px 10px",color:s.shortfall>0?C.red:C.greenDk,fontWeight:700}}>
                              {fmt(s.shortfall)}</td>
                            <td style={{padding:"8px 10px",color:C.green}}>{fmt(s.legacy)}</td>
                            <td style={{padding:"8px 10px"}}>
                              <span style={{background:rCol+"22",border:`1px solid ${rCol}`,
                                borderRadius:4,padding:"2px 8px",color:rCol,fontSize:11}}>{s.risk}</span>
                            </td>
                            <td style={{padding:"8px 10px",color:C.muted,fontSize:11}}>{s.outcome}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:8}}>
                  Best outcome: <strong style={{color:C.white}}>
                    {[...scenarios].sort((a,b)=>a.shortfall-b.shortfall)[0].name}
                  </strong> — Settlement Costs{" "}
                  {fmt([...scenarios].sort((a,b)=>a.shortfall-b.shortfall)[0].totalCosts)} |{" "}
                  Legacy to Heirs{" "}
                  {fmt([...scenarios].sort((a,b)=>a.shortfall-b.shortfall)[0].legacy)}
                </div>
              </div>

              {/* Legacy Over Time Chart */}
              <div style={{background:C.panel,borderRadius:10,padding:"16px",
                border:`1px solid ${C.border}`,marginBottom:16}}>
                <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:12}}>
                  📈 Legacy Over Time — Estate & Settlement Trajectory (Years 1–30)
                </div>
                <div style={{background:"#070f1e",borderRadius:8,padding:"10px 6px"}}>
                  <LineChart data={timeSeries} years={years}/>
                </div>
              </div>

              {/* Formula Methodology */}
              <div style={{background:C.panel,borderRadius:10,padding:"16px",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:10}}>
                  📐 Formula Methodology
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{background:C.cardLt}}>
                      {["Formula","Expression","Source"].map(h=>(
                        <th key={h} style={{padding:"6px 8px",color:C.muted,textAlign:"left"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Future estate value","PV × (1 + r)^n","CCIM curriculum / Finance 101"],
                      ["Estate tax","Taxable Estate × 40%","IRC Section 2001"],
                      ["Probate cost","Net Estate × 1%","NYL APG standard illustration"],
                      ["FLP gifting reduction","Estate × % Gifted × (1 − Discount)","IRC Sections 2036/2038"],
                      ["ILIT treatment","Excludes death benefit from taxable estate","IRC Section 2042"],
                      ["Liquidity shortfall","Settlement Costs − (Liquid Assets + Insurance)","Standard estate liquidity framework"],
                    ].map(([f,e,s],i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${C.grid}`,
                        background:i%2===0?"transparent":"rgba(26,58,92,0.3)"}}>
                        <td style={{padding:"6px 8px",color:C.white}}>{f}</td>
                        <td style={{padding:"6px 8px",color:C.goldLt,fontFamily:"monospace"}}>{e}</td>
                        <td style={{padding:"6px 8px",color:C.muted}}>{s}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{fontSize:10,color:C.muted,marginTop:8}}>
                  Exemption: USD 15,000,000 per individual (USD 30,000,000 married) — OBBBA signed July 4, 2025.
                  The prior TCJA sunset to approx. USD 7M was permanently eliminated. Indexed for inflation from 2027.
                </div>
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:12,marginTop:16}}>
            <button onClick={()=>setActiveStep(1)}
              style={{padding:"12px 24px",background:"transparent",border:`1px solid ${C.blue}`,
                color:C.blue,borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700}}>
              ← Back to Step 1
            </button>
            <button onClick={()=>setActiveStep(3)}
              style={{padding:"12px 32px",background:C.blue,border:"none",color:C.white,
                borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:700}}>
              Continue to Step 3 →
            </button>
          </div>
        </>}

        {/* ── STEP 3 ── */}
        {activeStep===3 && <>
          <SectionHeader caption="Generate a pre-formatted email summary to send to your client or to the NYL APG team.">
            Step 3 — Send Illustration Summary
          </SectionHeader>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            {/* Email to Client */}
            <div style={{background:C.panel,borderRadius:10,padding:"16px",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:12}}>📧 Email to Client</div>
              <TextInput label="Client Email Address" value={clientEmail}
                onChange={setClientEmail} placeholder="client@email.com"/>
              <button onClick={()=>{
                if(!clientEmail) return;
                const subj = encodeURIComponent(`Your Estate Liquidity Illustration — ${today}`);
                const body = encodeURIComponent(emailBody);
                window.open(`mailto:${clientEmail}?subject=${subj}&body=${body}`);
              }} style={{width:"100%",padding:"11px",background:C.blue,border:"none",
                color:C.white,borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700}}>
                📤 Open Email to Client
              </button>
            </div>

            {/* Email to APG */}
            <div style={{background:C.panel,borderRadius:10,padding:"16px",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:12}}>📧 Email to NYL APG Team</div>
              <TextInput label="APG Email Address" value={apgEmail} onChange={setApgEmail}/>
              <button onClick={()=>{
                const subj = encodeURIComponent(`APG Case Submission — ${clientDisplay} — ${today}`);
                const body = encodeURIComponent(emailBody);
                window.open(`mailto:${apgEmail}?subject=${subj}&body=${body}`);
              }} style={{width:"100%",padding:"11px",background:"#1a4a2a",border:`1px solid ${C.greenDk}`,
                color:C.greenDk,borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700}}>
                📤 Open Email to APG
              </button>
            </div>
          </div>

          {/* Full illustration text */}
          <div style={{background:C.panel,borderRadius:10,padding:"16px",border:`1px solid ${C.border}`,marginBottom:20}}>
            <div style={{fontSize:13,color:C.blue,fontWeight:700,marginBottom:10}}>
              📋 Full Illustration Summary (copy/paste)
            </div>
            <textarea readOnly value={emailBody}
              style={{width:"100%",height:400,background:C.card,border:`1px solid ${C.border}`,
                borderRadius:6,padding:"10px",color:C.white,fontSize:11,
                fontFamily:"monospace",resize:"vertical",outline:"none"}}/>
          </div>

          {/* Disclaimer */}
          <div style={{background:"#1a1a2e",borderRadius:10,padding:"16px",
            border:`1px solid rgba(255,107,107,0.3)`,marginBottom:20}}>
            <div style={{fontSize:12,color:C.red,fontWeight:700,marginBottom:8}}>⚠️ Important Disclaimer</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              This prototype is for educational and planning illustration purposes only.
              It does not provide legal, tax, insurance, investment, or estate planning advice.
              All outputs are simplified estimates based on user-entered assumptions and a basic modeling framework.
              Actual estate tax exposure, probate costs, liquidity needs, trust structures, gifting rules,
              insurance treatment, and settlement outcomes may differ materially.
              Users should review all important decisions with qualified estate planning attorneys,
              tax advisors, CPAs, insurance professionals, and financial advisors.
            </div>
          </div>

          <button onClick={()=>setActiveStep(2)}
            style={{padding:"12px 24px",background:"transparent",border:`1px solid ${C.blue}`,
              color:C.blue,borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700}}>
            ← Back to Step 2
          </button>
        </>}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <GateScreen onAuth={setUser}/>;
  return <EstateApp userName={user}/>;
}
