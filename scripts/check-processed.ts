process.loadEnvFile(new URL('../.env', import.meta.url));
const API = `https://api.getpinch.com.au/${process.env.PINCH_ENV||'test'}`;
let t='';
const basic=Buffer.from(`${process.env.PINCH_APP_ID}:${process.env.PINCH_SECRET}`).toString('base64');
const r=await fetch('https://auth.getpinch.com.au/connect/token',{method:'POST',headers:{Authorization:`Basic ${basic}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'api1'})});
t=(await r.json()).access_token;
const h={Authorization:`Bearer ${t}`,'pinch-version':process.env.PINCH_VERSION||'2020.1',Accept:'application/json'};
for(const p of ['/payments/processed','/payments/scheduled']){
  const res=await fetch(`${API}${p}`,{headers:h}); const j=await res.json();
  console.log(p,'-> total:',j.totalItems ?? j.data?.length,'| statuses:',JSON.stringify((j.data||[]).slice(0,5).map((x:any)=>x.status)));
}
