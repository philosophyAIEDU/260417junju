import React, { useState, useEffect, useRef } from 'react';
import { callText, callImage, buildSamPrompt, buildJennyPrompt, buildWillPrompt } from './gemini';

// ──── HEADER COMPONENT ────
function Header({ apiKey, onResetKey }) {
  return (
    <header>
      <h1 className="header__title">AI Proposal Generator</h1>
      <button 
        className={`header__api-badge ${!apiKey ? 'header__api-badge--missing' : ''}`}
        onClick={onResetKey}
      >
        {apiKey ? '🟢 API 연동됨 (키 변경)' : '🔴 API 키 필요'}
      </button>
    </header>
  );
}

// ──── API MODAL COMPONENT ────
function ApiModal({ onSave }) {
  const [key, setKey] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal__title">Gemini API 키 입력</h2>
        <p className="modal__desc">
          이 앱은 브라우저에서 직접 Gemini API를 호출합니다.<br />
          API 키는 서버에 전송되지 않으며 세션 스토리지에만 보관됩니다.
        </p>
        <input 
          type="password" 
          className="input" 
          placeholder="AIzaSy..." 
          value={key} 
          onChange={e => setKey(e.target.value)} 
        />
        <div className="flex-end">
          <button className="button" onClick={() => onSave(key)} disabled={!key}>저장 및 시작</button>
        </div>
      </div>
    </div>
  );
}

// ──── STEP INDICATOR ────
function StepIndicator({ currentStep }) {
  const steps = [
    { label: '템플릿' },
    { label: '기본정보' },
    { label: 'AI 생성' },
    { label: '결과확인' }
  ];

  return (
    <div className="step-indicator">
      {steps.map((step, idx) => {
        let statusClass = '';
        if (idx < currentStep) statusClass = 'step-indicator__item--done';
        else if (idx === currentStep) statusClass = 'step-indicator__item--active';

        return (
          <div key={idx} className={`step-indicator__item ${statusClass}`}>
            {idx < currentStep ? '✓' : idx + 1}
            <span className="step-indicator__label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ──── STEP 1: TEMPLATE ────
function TemplateStep({ onNext }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setError(null);
    setIsLoading(true);
    
    try {
      if (file.name.endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setText(result.value);
      } else if (file.name.endsWith('.txt')) {
        const textData = await file.text();
        setText(textData);
      } else if (file.name.endsWith('.pdf')) {
         setError("PDF는 지원하지 않습니다. 텍스트 붙여넣기를 사용해주세요.");
      } else {
        setError("지원하지 않는 파일 형식입니다. (.txt 또는 .docx만 가능)");
      }
    } catch (err) {
      console.error(err);
      setError("파일 파싱 실패. 텍스트 복사/붙여넣기를 사용해주세요.");
    } finally {
      setIsLoading(false);
      e.target.value = null;
    }
  };

  return (
    <div className="card">
      <h2 style={{color: 'var(--accent-gold)'}}>Step 1: 제안서 템플릿 입력</h2>
      <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>기존에 사용하시던 제안서 목차나 템플릿 구조를 입력해주세요.</p>
      
      {error && <div className="error-banner">{error}</div>}

      <div className="dropzone" onClick={() => document.getElementById('file-upload').click()}>
        <div className="dropzone__icon">📄</div>
        <h3>파일 업로드 (.docx 또는 .txt)</h3>
        <p style={{color: 'var(--text-secondary)'}}>클릭하여 파일을 선택하세요</p>
        <input 
          type="file" 
          id="file-upload" 
          accept=".docx,.txt,.pdf" 
          style={{display: 'none'}} 
          onChange={handleFileUpload} 
        />
      </div>

      <div className="divider">또는</div>
      
      <label className="label">텍스트 직접 입력 (붙여넣기)</label>
      <textarea 
        className="textarea" 
        placeholder="제안서 템플릿 내용을 여기에 붙여넣으세요..."
        value={text}
        onChange={e => setText(e.target.value)}
      />

      <div className="flex-end">
        <button 
          className="button" 
          onClick={() => onNext(text)} 
          disabled={!text || isLoading}
        >
          다음: 기본 정보 입력
        </button>
      </div>
    </div>
  );
}

// ──── STEP 2: BRIEF ────
function BriefStep({ onNext, onBack }) {
  const [brief, setBrief] = useState({
    clientName: '',
    projectTitle: '',
    description: '',
    duration: '',
    budget: '',
    requirements: ''
  });

  const handleChange = (e) => {
    setBrief({...brief, [e.target.name]: e.target.value});
  };

  return (
    <div className="card">
      <h2 style={{color: 'var(--accent-gold)'}}>Step 2: 새 제안서 정보 입력</h2>
      <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>생성할 제안서의 핵심 내용을 입력해주세요.</p>

      <label className="label">클라이언트 명칭 *</label>
      <input className="input" name="clientName" value={brief.clientName} onChange={handleChange} placeholder="예: (주)유저컴퍼니" />

      <label className="label">프로젝트 명 *</label>
      <input className="input" name="projectTitle" value={brief.projectTitle} onChange={handleChange} placeholder="새로운 프로젝트 명칭" />

      <label className="label">핵심 설명 (필수) *</label>
      <textarea className="textarea" name="description" value={brief.description} onChange={handleChange} placeholder="프로젝트의 목적과 주요 제안 내용을 적어주세요." style={{minHeight: '80px'}} />

      <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
        <div style={{flex: 1}}>
          <label className="label">수행 기간</label>
          <input className="input" name="duration" value={brief.duration} onChange={handleChange} placeholder="예: 3개월" style={{marginBottom: 0}} />
        </div>
        <div style={{flex: 1}}>
          <label className="label">예산액</label>
          <input className="input" name="budget" value={brief.budget} onChange={handleChange} placeholder="예: 5,000만원" style={{marginBottom: 0}} />
        </div>
      </div>

      <label className="label">추가 요구사항</label>
      <textarea className="textarea" name="requirements" value={brief.requirements} onChange={handleChange} placeholder="강조하고 싶은 점이나 기타 요구사항" style={{minHeight: '60px'}} />

      <div className="flex-between" style={{marginTop: '2rem'}}>
        <button className="button button--outline" onClick={onBack}>뒤로가기</button>
        <button 
          className="button" 
          onClick={() => onNext(brief)} 
          disabled={!brief.clientName || !brief.projectTitle || !brief.description}
        >
          제안서 생성 시작
        </button>
      </div>
    </div>
  );
}

// ──── STEP 3: GENERATING ────
function GeneratingStep({ apiKey, templateText, brief, onComplete, onBack }) {
  const [agents, setAgents] = useState({
    sam: { status: 'waiting' },
    jenny: { status: 'waiting' },
    will: { status: 'waiting' },
  });
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const started = useRef(false);
  const logEndRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), msg, type }]);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runWorkflow();
  }, []);

  const runWorkflow = async () => {
    try {
      // 1. Sam
      addLog("Sam: 템플릿 구조 및 톤앤매너 분석 중...", "info");
      setAgents(prev => ({...prev, sam: { status: 'running' }}));
      let samResult;
      try {
        const samJSON = await callText(apiKey, buildSamPrompt(templateText));
        const cleanJSON = samJSON.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        samResult = cleanJSON;
        addLog("Sam: 템플릿 구조 분석 완료.", "success");
      } catch (err) {
        addLog(`Sam: 분석 중 오류 - ${err.message}. 원본 텍스트를 그대로 사용합니다.`, "error");
        samResult = JSON.stringify({ structure_summary: "Fallback structure", template: templateText.slice(0, 1000) });
      }
      setAgents(prev => ({...prev, sam: { status: 'done' }}));
      setProgress(25);

      // 2. Jenny
      addLog("Jenny: 구조와 사용자 정보를 바탕으로 제안서 초안 작성 중...", "info");
      setAgents(prev => ({...prev, jenny: { status: 'running' }}));
      const jennyHtml = await callText(apiKey, buildJennyPrompt(samResult, brief));
      addLog("Jenny: HTML 제안서 초안 완성.", "success");
      setAgents(prev => ({...prev, jenny: { status: 'done' }}));
      setProgress(55);

      // 3. Will
      addLog("Will: 제안서 품질 검토 및 HTML 정제 중...", "info");
      setAgents(prev => ({...prev, will: { status: 'running' }}));
      let finalHtmlRaw = await callText(apiKey, buildWillPrompt(jennyHtml));
      finalHtmlRaw = finalHtmlRaw.replace(/```html\n?/g, '').replace(/```/g, '').trim();
      addLog("Will: 제안서 최종 검토 완료.", "success");
      setAgents(prev => ({...prev, will: { status: 'done' }}));
      setProgress(75);

      // 4. Image Generation
      addLog("System: 이미지 플레이스홀더 검사 중...", "info");
      
      const imageRegex = /\{\{IMAGE:\s*(.*?)\}\}/g;
      let finalHtml = finalHtmlRaw;
      const matches = [...finalHtmlRaw.matchAll(imageRegex)].slice(0, 3);
      
      if (matches.length > 0) {
        addLog(`System: ${matches.length}개의 이미지 생성 요청 발견. 병렬 작업 시작...`, "info");
        
        const imagePromises = matches.map(match => {
          const description = match[1];
          return callImage(apiKey, description).then(dataUri => ({ match: match[0], dataUri }));
        });
        
        const results = await Promise.allSettled(imagePromises);
        let successCount = 0;
        
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value.dataUri) {
            finalHtml = finalHtml.replace(res.value.match, `<img src="${res.value.dataUri}" alt="Generated Image" style="width:100%; border-radius:8px; margin: 20px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" />`);
            successCount++;
          } else {
             // Failed, just remove placeholder implicitly handled
             const matchText = res.status === 'fulfilled' ? res.value.match : matches.find(m => m[0] === res.reason?.match)?.match;
             if(matchText) finalHtml = finalHtml.replace(matchText, '');
          }
        });
        addLog(`System: ${successCount}개의 이미지를 성공적으로 생성했습니다.`, "success");
      } else {
        addLog("System: 생성할 이미지 플레이스홀더가 없습니다.", "info");
      }
      
      setProgress(100);
      addLog("System: 모든 작업이 완료되었습니다! 렌더링을 준비합니다.", "success");
      
      setTimeout(() => onComplete(finalHtml), 1500);

    } catch (err) {
       addLog(`Critical Error: ${err.message}`, "error");
       setErrorMsg(err.message);
       setAgents(prev => {
         const newAgents = {...prev};
         Object.keys(newAgents).forEach(k => {
           if (newAgents[k].status === 'running') newAgents[k].status = 'error';
         });
         return newAgents;
       });
    }
  }

  const getEmojiClass = (status) => {
    if (status === 'running') return 'thinking-dots';
    return '';
  }

  return (
    <div className="card">
      <h2 style={{color: 'var(--accent-gold)'}}>Step 3: AI 워크플로우 진행 중</h2>
      <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>전문 에이전트들이 제안서를 작성하고 있습니다.</p>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div className="agents-container">
        <div className={`agent-card agent-card--${agents.sam.status}`}>
          <div className={`agent-card__emoji ${getEmojiClass(agents.sam.status)}`}>🔷</div>
          <div className="agent-card__name">Sam</div>
          <div className="agent-card__role">구조 분석가</div>
          <span className="agent-card__status">{agents.sam.status.toUpperCase()}</span>
        </div>

        <div className={`agent-card agent-card--${agents.jenny.status}`}>
          <div className={`agent-card__emoji ${getEmojiClass(agents.jenny.status)}`}>🔶</div>
          <div className="agent-card__name">Jenny</div>
          <div className="agent-card__role">콘텐츠 작성자</div>
          <span className="agent-card__status">{agents.jenny.status.toUpperCase()}</span>
        </div>

        <div className={`agent-card agent-card--${agents.will.status}`}>
          <div className={`agent-card__emoji ${getEmojiClass(agents.will.status)}`}>🔹</div>
          <div className="agent-card__name">Will</div>
          <div className="agent-card__role">품질 검토자</div>
          <span className="agent-card__status">{agents.will.status.toUpperCase()}</span>
        </div>
      </div>

      <div className="progress-container">
        <div className="progress-bar" style={{width: `${progress}%`}}></div>
      </div>

      <div className="gen-log">
        {logs.map((log) => (
          <div key={log.id} className={`log-entry log-entry--${log.type}`}>
            <span style={{color: '#6B7280'}}>[{log.time}]</span> {log.msg}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {errorMsg && (
        <div className="flex-start" style={{marginTop: '2rem'}}>
          <button className="button button--outline" onClick={onBack}>뒤로 돌아가기</button>
        </div>
      )}
    </div>
  );
}

// ──── STEP 4: RESULT ────
function ResultStep({ resultHtml, onBack }) {

  const handleDownload = () => {
    // Generate standalone HTML with internal CSS for offline viewing
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Generated Proposal</title>
        <style>
          body { font-family: 'Noto Sans KR', sans-serif; line-height: 1.6; padding: 2rem; color: #333; max-width: 900px; margin: 0 auto; }
          h1 { color: #1E3A8A; font-size: 2.2rem; border-bottom: 2px solid #1E3A8A; padding-bottom: 0.5rem; font-family: 'Cormorant Garamond', serif; }
          h2 { color: #2563EB; border-left: 4px solid #2563EB; padding-left: 0.5rem; margin-top: 2rem; font-family: 'Cormorant Garamond', serif; }
          h3 { color: #1E40AF; }
          table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
          th, td { border: 1px solid #E5E7EB; padding: 0.75rem; text-align: left; }
          th { background-color: #DBEAFE; color: #1E3A8A; }
          img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }
        </style>
      </head>
      <body>
        ${resultHtml}
      </body>
      </html>
    `;
    
    const blob = new Blob([printHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '제안서.html';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print(); // Simple window.print(), could be improved by opening a new window with the html but this works for simple usage
  };

  return (
    <div className="card">
       <div className="flex-between" style={{marginBottom: '2rem'}}>
         <h2 style={{color: 'var(--accent-gold)', margin: 0}}>Step 4: 제안서 결과</h2>
         <div style={{display: 'flex', gap: '1rem'}}>
           <button className="button button--outline" onClick={handlePrint}>인쇄</button>
           <button className="button" onClick={handleDownload}>HTML 다운로드</button>
         </div>
       </div>

       <div className="proposal-preview" dangerouslySetInnerHTML={{__html: resultHtml}}>
       </div>

       <div className="flex-start" style={{marginTop: '2rem'}}>
          <button className="button button--outline" onClick={onBack}>처음으로 돌아가기</button>
       </div>
    </div>
  );
}

// ──── MAIN APP ROUTER ────
export default function App() {
  const [apiKey, setApiKey] = useState(sessionStorage.getItem('GEMINI_API_KEY') || '');
  const [showApiModal, setShowApiModal] = useState(!sessionStorage.getItem('GEMINI_API_KEY'));
  
  const [step, setStep] = useState(0);
  const [templateText, setTemplateText] = useState('');
  const [brief, setBrief] = useState(null);
  const [resultHtml, setResultHtml] = useState('');

  const saveApiKey = (key) => {
    sessionStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setShowApiModal(false);
  };

  return (
    <>
      <Header apiKey={apiKey} onResetKey={() => setShowApiModal(true)} />
      
      <main>
        <StepIndicator currentStep={step} />

        {step === 0 && (
          <TemplateStep onNext={(text) => { setTemplateText(text); setStep(1); }} />
        )}

        {step === 1 && (
          <BriefStep 
            onNext={(data) => { setBrief(data); setStep(2); }} 
            onBack={() => setStep(0)} 
          />
        )}

        {step === 2 && (
          <GeneratingStep 
            apiKey={apiKey}
            templateText={templateText}
            brief={brief}
            onComplete={(html) => { setResultHtml(html); setStep(3); }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <ResultStep 
            resultHtml={resultHtml} 
            onBack={() => { setStep(0); setTemplateText(''); setBrief(null); setResultHtml(''); }} 
          />
        )}
      </main>

      {showApiModal && <ApiModal onSave={saveApiKey} />}
    </>
  );
}
