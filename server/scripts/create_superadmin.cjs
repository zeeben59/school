const fs = require('fs');
const fetch = require('node-fetch');
(async()=>{
  const env = fs.readFileSync(__dirname + '/../.env','utf8').split(/\r?\n/).reduce((acc,line)=>{const m=line.match(/^([^=]+)=(.*)$/);if(m){acc[m[1]]=m[2].replace(/^\"|\"$/g,'')}return acc},{})
  const supaUrl = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const email = env.SUPERADMIN_EMAIL
  const pass = env.SUPERADMIN_PASSWORD
  console.log('creating',email)
  try{
    const res1 = await fetch(supaUrl + '/auth/v1/admin/users',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'apikey':key},body:JSON.stringify({email,password:pass,email_confirm:true,user_metadata:{role:'SUPERADMIN'}})})
    console.log('status',res1.status)
    const t1 = await res1.text(); console.log(t1)
    if(res1.status===200||res1.status===201){
      const user = JSON.parse(t1)
      console.log('created user',user.id)
      const res2 = await fetch(supaUrl + '/rest/v1/profiles',{method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+key,'Prefer':'return=representation'},body:JSON.stringify({id:user.id,email:email,role:'SUPERADMIN'})})
      console.log('profile',res2.status,await res2.text())
    }
  }catch(err){console.error(err)}
})()
