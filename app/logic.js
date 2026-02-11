
// Simulation avancée avec Contrôleur + Mode Démo + ETA
(function(){
  const RESOURCE='Processus_deces_retraites.accdb';
  const KEY='resa_state_v1';
  const CLIENT_KEY='resa_client_v1';
  const ADMIN_CODE_KEY='resa_admin_code_v1';
  const DEMO_KEY='resa_demo_mode_v1';

  // Durées
  const PROD_SESSION_MIN=120; // 2h
  const DEMO_SESSION_MIN=2;   // 2 minutes
  const TICK_MS=1000;

  const chan=('BroadcastChannel'in window)?new BroadcastChannel('resa_channel_v1'):null;
  const el=id=>document.getElementById(id);
  const now=()=>Date.now();

  // Etat client
  let client=JSON.parse(localStorage.getItem(CLIENT_KEY)||'null');
  if(!client){
    client={id:crypto.randomUUID(),name:'',isAdmin:false};
    localStorage.setItem(CLIENT_KEY,JSON.stringify(client));
  }

  let adminCode=localStorage.getItem(ADMIN_CODE_KEY)||'admin';
  let demoMode=localStorage.getItem(DEMO_KEY)==='1';

  // DOM
  const nameInput=el('displayName');
  const saveNameBtn=el('saveName');
  const toggleAdminBtn=el('toggleAdmin');
  const toggleDemoBtn=el('toggleDemo');

  const reserveBtn=el('reserveBtn');
  const releaseBtn=el('releaseBtn');
  const leaveQueueBtn=el('leaveQueueBtn');
  const statusPill=el('statusPill');
  const who=el('who');
  const queueList=el('queueList');
  const countdown=el('countdown');
  const refreshBtn=el('refreshBtn');
  const hint=el('hint');
  const adminPanel=el('adminPanel');

  const adminForceRelease=el('adminForceRelease');
  const adminNext=el('adminNext');
  const adminMinus1=el('adminMinus1');
  const adminPlus5=el('adminPlus5');
  const adminClearQueue=el('adminClearQueue');
  const adminReset=el('adminReset');

  nameInput.value=client.name||'';
  updateAdminUI();
  updateDemoUI();

  saveNameBtn.onclick=()=>{
    client.name=(nameInput.value||'').trim()||'Utilisateur';
    localStorage.setItem(CLIENT_KEY,JSON.stringify(client));
    toast('Nom enregistré.');
    render();
  };

  toggleAdminBtn.onclick=()=>{
    if(client.isAdmin){
      client.isAdmin=false;
      localStorage.setItem(CLIENT_KEY,JSON.stringify(client));
      toast('Mode contrôleur désactivé.');
      updateAdminUI();
      render();
      return;
    }
    const code=prompt('Code contrôleur (défaut : "admin") :','');
    if(code===null) return;
    if(code===(localStorage.getItem(ADMIN_CODE_KEY)||'admin')){
      client.isAdmin=true;
      localStorage.setItem(CLIENT_KEY,JSON.stringify(client));
      toast('Mode contrôleur activé.');
      updateAdminUI();
      render();
    } else toast('Code incorrect.');
  };

  toggleDemoBtn.onclick=()=>{
    demoMode=!demoMode;
    localStorage.setItem(DEMO_KEY,demoMode?'1':'0');
    updateDemoUI();

    if(demoMode){
      const s=readState();
      if(!s.active){
        s.active={
          userId:'demo-1',
          name:'Utilisateur A',
          start:now(),
          end:now()+sessionMinutes()*60000
        };
      }
      if(s.queue.length===0){
        s.queue=[
          {userId:'demo-2',name:'Utilisateur B',enqueued:now()},
          {userId:'demo-3',name:'Utilisateur C',enqueued:now()},
          {userId:'demo-4',name:'Utilisateur D',enqueued:now()}
        ];
      }
      writeState(s);
      toast('Démo rapide activée.');
    } else {
      toast('Démo rapide désactivée.');
    }
    render();
  };

  reserveBtn.onclick=()=>reserveNow();
  releaseBtn.onclick=()=>release();
  leaveQueueBtn.onclick=()=>leaveQueue();
  refreshBtn.onclick=()=>render();

  if(chan){
    chan.onmessage=e=>{
      if(e.data&&e.data.type==='STATE_CHANGED') render();
    };
  }

  function toast(m){
    hint.textContent=m;
    setTimeout(()=>{if(hint.textContent===m) hint.textContent='';},4000);
  }

  function readState(){
    let s=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!s){
      s={resource:RESOURCE,active:null,queue:[]};
      localStorage.setItem(KEY,JSON.stringify(s));
    }
    return s;
  }

  function writeState(s){
    localStorage.setItem(KEY,JSON.stringify(s));
    if(chan) chan.postMessage({type:'STATE_CHANGED'});
  }

  function sessionMinutes(){return demoMode?DEMO_SESSION_MIN:PROD_SESSION_MIN;}

  function reserveNow(){
    if(!client.name){ toast('Renseigne ton nom.'); return; }
    const s=readState();
    if(!s.active){
      s.active={userId:client.id,name:client.name,start:now(),end:now()+sessionMinutes()*60000};
      writeState(s); toast('Réservation confirmée.'); render(); return;
    }
    if(s.active.userId===client.id){ toast('Tu utilises déjà la ressource.'); return; }
    if(s.queue.find(q=>q.userId===client.id)){ toast('Déjà dans la file.'); return; }
    s.queue.push({userId:client.id,name:client.name,enqueued:now()});
    writeState(s); toast('Ajouté(e) à la file.'); render();
  }

  function leaveQueue(){
    const s=readState();
    const before=s.queue.length;
    s.queue=s.queue.filter(q=>q.userId!==client.id);
    writeState(s);
    toast(before!==s.queue.length?'Tu as quitté la file.':'Tu n’étais pas dans la file.');
    render();
  }

  function release(){
    const s=readState();
    if(s.active && s.active.userId!==client.id && !client.isAdmin){
      toast('Tu n’as pas la main.'); return;
    }
    s.active=null;
    if(s.queue.length>0){
      const nxt=s.queue.shift();
      s.active={userId:nxt.userId,name:nxt.name,start:now(),end:now()+sessionMinutes()*60000};
      toast(`La ressource passe à ${nxt.name}.`);
    } else toast('Ressource libérée.');
    writeState(s); render();
  }

  // → ADMIN actions
  adminForceRelease.onclick=()=>{
    if(!client.isAdmin) return;
    const s=readState(); s.active=null; writeState(s); toast('Libération forcée.'); render();
  };

  adminNext.onclick=()=>{
    if(!client.isAdmin) return;
    const s=readState();
    if(s.queue.length===0){ toast('File vide'); return; }
    const nxt=s.queue.shift();
    s.active={userId:nxt.userId,name:nxt.name,start:now(),end:now()+sessionMinutes()*60000};
    writeState(s);
    toast('Attribué au suivant.');
    render();
  };

  adminMinus1.onclick=()=>{
    if(!client.isAdmin) return;
    const s=readState(); if(!s.active){toast('Aucune session active.'); return;}
    s.active.end=Math.max(now(),s.active.end-60000);
    writeState(s);
    render();
  };

  adminPlus5.onclick=()=>{
    if(!client.isAdmin) return;
    const s=readState(); if(!s.active){toast('Aucune session active.'); return;}
    s.active.end=s.active.end+5*60000;
    writeState(s);
    render();
  };

  adminClearQueue.onclick=()=>{
    if(!client.isAdmin) return;
    const s=readState(); s.queue=[]; writeState(s); toast('File vidée.'); render();
  };

  adminReset.onclick=()=>{
    if(!client.isAdmin){ toast('Mode contrôleur requis.'); return; }
    if(confirm('Réinitialiser toute la simulation ?')){
      localStorage.removeItem(KEY);
      const newCode=prompt('Nouveau code admin (défaut : admin) :','')||'admin';
      localStorage.setItem(ADMIN_CODE_KEY,newCode);
      writeState({resource:RESOURCE,active:null,queue:[]});
      toast('État réinitialisé.');
      render();
    }
  };

  // ETA helper
  function fmtDur(ms){
    const m=Math.floor(ms/60000);
    const h=Math.floor(m/60);
    const mm=m%60;
    return h>0?`${h}h ${mm}m`:`${mm}m`;
  }

  function etaForIndex(idx,s){
    const per=sessionMinutes()*60000;
    let base=0;
    if(s.active) base=Math.max(0,s.active.end-now());
    if(!s.active && idx===0) return {dur:0,abs:new Date(now())};
    const dur=base + idx*per;
    return {dur,abs:new Date(now()+dur)};
  }

  // Tick
  setInterval(()=>{
    const s=readState();
    if(s.active && s.active.end<=now()){
      s.active=null;
      if(s.queue.length>0){
        const nxt=s.queue.shift();
        s.active={userId:nxt.userId,name:nxt.name,start:now(),end:now()+sessionMinutes()*60000};
      }
      writeState(s);
    }
    renderCountdown();
  },TICK_MS);

  function renderCountdown(){
    const s=readState();
    if(!s.active){ countdown.textContent=''; return; }
    const rem=Math.max(0,s.active.end-now());
    const h=Math.floor(rem/3600000);
    const m=Math.floor((rem%3600000)/60000);
    const sec=Math.floor((rem%60000)/1000);
    countdown.textContent=`Temps restant : ${h}h ${m}m ${sec}s`;
  }

  function updateAdminUI(){
    toggleAdminBtn.classList.toggle('active',!!client.isAdmin);
    adminPanel.style.display=client.isAdmin?'block':'none';
    toggleAdminBtn.textContent=client.isAdmin?'Désactiver mode contrôleur':'Activer mode contrôleur';
  }

  function updateDemoUI(){
    toggleDemoBtn.classList.toggle('active',!!demoMode);
    toggleDemoBtn.textContent=demoMode?'Désactiver démo rapide':'Activer démo rapide';
  }

  function render(){
    const s=readState();
    if(!s.active){
      statusPill.className='status-pill free';
      statusPill.textContent='Statut : Disponible';
      who.textContent='';
      releaseBtn.style.display='none';
      reserveBtn.style.display='inline-block';
    } else {
      statusPill.className='status-pill busy';
      statusPill.textContent='Statut : Occupée';
      const end=new Date(s.active.end);
      who.textContent=`Par : ${s.active.name} • Fin prévue : ${end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
      if(s.active.userId===client.id || client.isAdmin){
        releaseBtn.style.display='inline-block';
      } else releaseBtn.style.display='none';
    }

    queueList.innerHTML='';
    const meId=client.id;
    const sQueue=readState().queue;

    sQueue.forEach((q,idx)=>{
      const li=document.createElement('li');
      li.setAttribute('data-idx',String(idx));

      const spanName=document.createElement('span');
      spanName.textContent=`${idx+1}. ${q.name}`;

      const spanEta=document.createElement('span');
      const {dur,abs}=etaForIndex(idx,s);
      spanEta.className='eta';
      spanEta.textContent=(!s.active && idx===0)?'ETA : maintenant':`ETA : ~${fmtDur(dur)}`;
      spanEta.title=`~ ${abs.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

      li.appendChild(spanName);
      li.appendChild(spanEta);

      if(q.userId===meId) li.classList.add('me');

      queueList.appendChild(li);
    });

    const myInQueue=sQueue.some(q=>q.userId===meId);
    leaveQueueBtn.style.display=myInQueue?'inline-block':'none';

    renderCountdown();
  }

  render();
})();
