import placesJson from '../../data/places.json'
import itineraryJson from '../../data/itinerary.json'
import transitJson from '../../data/transit.json'
import type { EngineData, Itinerary, Place, Transit } from '../types'

/** 앱에 들어 있는 기본 데이터. 테스트에서는 다른 데이터를 직접 넘길 수 있다 */
export const defaultData: EngineData = {
  places: (placesJson as unknown as { places: Place[] }).places,
  itinerary: itineraryJson as unknown as Itinerary,
  transit: transitJson as unknown as Transit,
}
