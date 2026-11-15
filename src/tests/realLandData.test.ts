import { describe,it,expect,vi } from 'vitest';
import raw from '../data/real-data/terrain-v1.json';
import {TerrainPackageSchema,resolveRealLand,terrainSlopePercent} from '../services/realLandData';
import {fetchLandSummary} from '../services/landSummary';
const data=TerrainPackageSchema.parse(raw);
describe('real SRTM terrain package',()=>{
 it.each(data.grids)('resolves the actual source post for $id without synthetic auxiliary metrics',async grid=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('offline'));
  const result=await fetchLandSummary(grid.lat,grid.lon);
  expect(result.elevationM).toBe(grid.elevationM[17*35+17]);
  expect(result.provenance.elevationM.tier).toBe('bundled-model');
  expect(result.isSample).toBe(false);expect(result.floodProne).toBe(result.elevationM!<30&&result.slopePct!<=3);expect(result.provenance.floodProne.methodKey).toBe('mvp.lowlandMethod');
  expect(result.rusleErosionRiskTonsHaYr).toBeNull();expect(result.ndvi.evidence?.total).toBe(115);expect(result.provenance['ndvi.seasonalMean'].isSynthetic).toBe(false);
  expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
 });
 it('rejects data outside the native coverage and does not borrow a pilot point',()=>{
  expect(resolveRealLand(0,0)).toBeNull();expect(resolveRealLand(15.8,120.906)).toBeNull();
 });
 it('preserves zero elevation and null source posts',()=>{
  const copy=structuredClone(data);const grid=copy.grids[0];grid.elevationM[612]=0;
  expect(resolveRealLand(grid.lat,grid.lon,copy)?.elevationM).toBe(0);
  grid.elevationM[612]=null;
  expect(resolveRealLand(grid.lat,grid.lon,copy)?.elevationM).toBeNull();
  expect(resolveRealLand(grid.lat,grid.lon,copy)?.slopePct).toBeNull();
 });
 it('uses metric distances for a hand-computed eastward plane and rejects incomplete neighborhoods',()=>{
  const lat=15;const phi=lat*Math.PI/180;const dx=6378137/Math.sqrt(1-0.0066943799901413165*Math.sin(phi)**2)*Math.cos(phi)*Math.PI/(180*3600);
  expect(terrainSlopePercent([0,dx,2*dx,0,dx,2*dx,0,dx,2*dx],lat)).toBe(100);
  expect(terrainSlopePercent(Array(9).fill(71),lat)).toBe(0);
  expect(terrainSlopePercent([null,1,2,3,4,5,6,7,8],lat)).toBeNull();
 });
 it('rejects malformed arrays and coordinate-grid mismatches',()=>{
  const bad=structuredClone(raw);bad.grids[0].elevationM.pop();expect(TerrainPackageSchema.safeParse(bad).success).toBe(false);
  const shifted=structuredClone(raw);shifted.grids[0].northArcSeconds++;expect(TerrainPackageSchema.safeParse(shifted).success).toBe(false);
 });
});

it('uses real slope evidence in existing soil rules without retaining legacy substitutes',async()=>{
 const {withTerrainEvidence}=await import('../services/realLandData');
 const land=resolveRealLand(15.714,120.906)!;
 const soil:import('../types').SoilData={source:'test',texture:'loam',drainage:'well',organicMatter:'medium',ph:6.3,isEstimate:false,slopePct:99};
 expect(withTerrainEvidence(soil,land).slopePct).toBe(land.slopePct);
 expect(withTerrainEvidence(soil,{...land,slopePct:null}).slopePct).toBeUndefined();
 expect(withTerrainEvidence(soil,{...land,isSample:true})).toBe(soil);
});
