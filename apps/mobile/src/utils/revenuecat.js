import { Platform } from 'react-native'
import Purchases from 'react-native-purchases'

const REVENUECAT_API_KEY_IOS = 'appl_upRblPdRiEMUBzbFfRJyldjRJHH'
const REVENUECAT_API_KEY_ANDROID = 'goog_HepVbTKqCjlYUfecehJcIpdZVhm'

export async function initRevenueCat() {
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID
    Purchases.configure({ apiKey })
  } catch (e) {
    console.warn('[RevenueCat] init failed', e)
  }
}
