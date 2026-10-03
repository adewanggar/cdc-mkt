import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWA,safeURL,slug,shortlinkCode,randomShortlinkCode,parseHours,openingStatus,ipHash,device,csvCell,csrfEqual,passwordInput} from '../src/helpers.js';
test('WhatsApp handles Indonesian and international numbers; rejects malformed input',()=>{
 assert.equal(normalizeWA('0812-3456 7890'),'6281234567890');assert.equal(normalizeWA('+62 81234567890'),'6281234567890');assert.equal(normalizeWA('006281234567890'),'6281234567890');
 for(const s of ['abc08123456789','123','0000','080123456789012345678']) assert.throws(()=>normalizeWA(s));
});
test('URL and slug validation prevents script URLs and untrusted Maps destinations',()=>{
 assert.equal(safeURL('https://maps.app.goo.gl/example','maps'),'https://maps.app.goo.gl/example');
 for(const u of ['javascript:alert(1)','http://example.com','https://user:password@example.com','https://evil.test/google.com']) assert.throws(()=>safeURL(u,'maps'));
 assert.equal(safeURL('tel:+62215550123','phone'),'tel:+62215550123');assert.throws(()=>safeURL('tel:abc','phone'));
 assert.equal(slug('budi-santoso'),'budi-santoso');for(const s of ['default','../admin','Budi',"budi' OR 1=1"]) assert.throws(()=>slug(s));
});
test('Shortlink codes preserve case and generate eight Base62 characters',()=>{
 assert.equal(shortlinkCode('PromoLab7'),'PromoLab7');assert.equal(shortlinkCode('promo-lab'),'promo-lab');
 assert.notEqual(shortlinkCode('Promo'),shortlinkCode('promo'));
 for(const code of ['',undefined,'a'.repeat(81),'../admin','promo lab','é','promo--lab','promo_lab']) assert.throws(()=>shortlinkCode(code));
 for(let i=0;i<32;i++) assert.match(randomShortlinkCode(),/^[A-Za-z0-9]{8}$/);
});
test('WIB hours include overnight shifts and closed days',()=>{
 const h={1:{open:'22:00',close:'02:00'},2:null};
 assert.equal(openingStatus(h,new Date('2026-10-05T16:00:00Z')).open,true);
 assert.equal(openingStatus(h,new Date('2026-10-05T18:00:00Z')).open,true);
 assert.equal(openingStatus(h,new Date('2026-10-05T19:00:00Z')).open,false);
 const input=Object.fromEntries(Array.from({length:7},(_,i)=>[`closed_${i}`,'1']));input.closed_1='';input.open_1='07:00';input.close_1='20:00';assert.deepEqual(parseHours(input)[1],{open:'07:00',close:'20:00'});
 input.open_1='99:00';assert.throws(()=>parseHours(input));
});
test('Analytics privacy and export protections',()=>{
 assert.match(ipHash('127.0.0.1','secret'),/^[a-f0-9]{64}$/);assert.notEqual(ipHash('127.0.0.1','a'),ipHash('127.0.0.1','b'));
 assert.equal(device('iPhone Mobile'),'mobile');assert.equal(device('iPad'),'tablet');assert.equal(device('Windows NT'),'desktop');
 assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('a"b'),'"a""b"');
 assert.equal(csrfEqual('same','same'),true);assert.equal(csrfEqual('same','diff'),false);assert.equal(csrfEqual(null,'x'),false);
 assert.equal(csrfEqual('éé','ab'),false);assert.equal(passwordInput('  secure password  '),'  secure password  ');assert.throws(()=>passwordInput('a'.repeat(73)));
});
