import test from 'node:test'; import assert from 'node:assert'; import { createRequire } from 'module'; const require=createRequire(import.meta.url)
const B=require('../lib/booking.js')
test('service_zips adds a far trainer only for those ZIPs',()=>{
  const settings=B.mergeSettings([{slug:'victoria-bayleigh-morris',active:true,schedule_id:'A'.repeat(30),service_zips:['32312','32309','32317']}])
  const trainers=[{slug:'victoria-bayleigh-morris',full_name:'Victoria Morris',base_zip:'32405',status:'active',market:'Panama City'}]
  for (const z of ['32312','32309','32317']) assert.equal(B.nearbyTrainers(z,trainers,settings).length,1,z)
  assert.equal(B.nearbyTrainers('32301',trainers,settings).length,0)
  assert.equal(B.nearbyTrainers('32407',trainers,settings).length,1)
})
