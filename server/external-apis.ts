import axios from 'axios';
import { db } from './db';

// Base endpoints - smsbower.page prioritized
const SMSBOWER_DOMAINS = [
  'https://smsbower.page',
  'https://smsbower.online',
  'https://smsbower.app',
  'https://smsbower.org'
];
const VSIMPRO_URL = 'https://api.vsimpro.com/stubs/handler_api.php';

// Get API keys from database settings or environment
export function getOtpApiKey(): string {
  try {
    const dbKey = db?.getSettingValue ? db.getSettingValue('otp_api_key', '') : '';
    if (dbKey && isKeyConfigured(dbKey)) return dbKey.trim();
  } catch (e) {}
  return (process.env.OTP_API_KEY || '').trim();
}

export function getVsimproApiKey(): string {
  try {
    const dbKey = db?.getSettingValue ? db.getSettingValue('vsimpro_api_key', '') : '';
    if (dbKey && isKeyConfigured(dbKey)) return dbKey.trim();
  } catch (e) {}
  return (process.env.VSIMPRO_API_KEY || '').trim();
}

export function isKeyConfigured(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  const upper = trimmed.toUpperCase();
  if (
    upper.includes('YOUR_') || 
    upper.includes('MY_') || 
    upper.includes('API_KEY') || 
    upper.includes('PLACEHOLDER') || 
    trimmed === ''
  ) {
    return false;
  }
  return trimmed.length >= 8;
}

interface SimulatedActivation {
  createdAt: number;
  service: string;
  phoneNumber: string;
  code: string;
  status: 'waiting' | 'cancelled' | 'completed';
}

interface SimulatedMail {
  createdAt: number;
  mailAddress: string;
  code: string;
  status: 'waiting' | 'cancelled' | 'completed';
}

const simulatedActivations = new Map<string, SimulatedActivation>();
const simulatedMails = new Map<string, SimulatedMail>();

function getProviderConfig(provider: 'smsbower' | 'vsimpro') {
  return provider === 'smsbower' 
    ? { url: 'https://smsbower.online/stubs/handler_api.php', key: getOtpApiKey() }
    : { url: VSIMPRO_URL, key: getVsimproApiKey() };
}

/**
 * Generic handler for SMSBOWER and VSIMPRO API (since they share the same handler_api.php protocol)
 */
export async function providerApiCall(
  provider: 'smsbower' | 'vsimpro',
  action: string,
  params: Record<string, any> = {}
): Promise<string> {
  const { url, key } = getProviderConfig(provider);
  
  // Use Sandbox Simulation fallback if key is not configured
  if (!isKeyConfigured(key)) {
    console.log(`[SANDBOX SIMULATION] ${provider.toUpperCase()} API key is not configured. Running in Sandbox Simulation Mode.`);
    
    if (action === 'getBalance') {
      return 'ACCESS_BALANCE:10.50';
    }

    if (action === 'getPrices') {
      // Mock pricing structure matching standard SMSBower / SMS-Activate getPrices JSON
      const mockPrices: Record<string, any> = {
        "12": { "fb": { "3228": 125, "count": 125, "cost": 0.026, "0.026": 125 } }, // USA
        "30": { "fb": { "2377": 85, "count": 85, "cost": 0.004, "0.004": 85 } },   // Yemen
        "38": { "fb": { "count": 45, "cost": 0.015, "0.015": 45 } },                 // Ghana
        "53": { "fb": { "count": 60, "cost": 0.020, "0.020": 60 } },                 // Saudi
        "6": { "fb": { "count": 110, "cost": 0.018, "0.018": 110 } },                // Indonesia
        "128": { "fb": { "count": 35, "cost": 0.025, "0.025": 35 } },                // Georgia
        "98": { "fb": { "count": 40, "cost": 0.030, "0.030": 40 } },                 // Sudan
        "69": { "fb": { "count": 55, "cost": 0.022, "0.022": 55 } },                 // Mali
        "33": { "fb": { "count": 70, "cost": 0.028, "0.028": 70 } },                 // Colombia
        "73": { "fb": { "count": 95, "cost": 0.032, "0.032": 95 } },                 // Brazil
        "15": { "fb": { "count": 50, "cost": 0.015, "0.015": 50 } },                 // Poland
        "16": { "fb": { "count": 80, "cost": 0.018, "0.018": 80 } }                  // UK
      };
      
      if (params.country && mockPrices[String(params.country)]) {
        return JSON.stringify({ [String(params.country)]: mockPrices[String(params.country)] });
      }
      return JSON.stringify(mockPrices);
    }

    if (action === 'getNumbersStatus') {
      if (params.country) {
        return JSON.stringify({ "fb_0": 95, "fb_1": 0, "go_0": 40, "vk_0": 20 });
      }
      return JSON.stringify({
        "12": { "fb_0": 125 },
        "30": { "fb_0": 85 },
        "38": { "fb_0": 45 },
        "53": { "fb_0": 60 },
        "6": { "fb_0": 110 }
      });
    }

    if (action === 'getNumberV2' || action === 'getNumber') {
      const actId = String(Math.floor(100000000 + Math.random() * 900000000));
      const prefix = params.country ? String(params.country) : '92';
      const randomDigits = String(Math.floor(1000000 + Math.random() * 9000000));
      const phoneNumber = `${prefix}${randomDigits}`;
      const code = String(Math.floor(10000 + Math.random() * 90000));
      
      simulatedActivations.set(actId, {
        createdAt: Date.now(),
        service: params.service || 'fb',
        phoneNumber,
        code,
        status: 'waiting'
      });
      
      console.log(`[SANDBOX SIMULATION] Created mock activation ${actId} for phone ${phoneNumber}`);
      return `ACCESS_NUMBER:${actId}:${phoneNumber}:0.10`;
    }
    
    if (action === 'getStatus') {
      const actId = String(params.id || '');
      const sim = simulatedActivations.get(actId);
      if (!sim) {
        return 'STATUS_CANCEL';
      }
      if (sim.status === 'cancelled') {
        return 'STATUS_CANCEL';
      }
      const elapsed = Date.now() - sim.createdAt;
      if (elapsed >= 10000) {
        sim.status = 'completed';
        console.log(`[SANDBOX SIMULATION] Delivering simulated OTP code ${sim.code} for activation ${actId}`);
        return `STATUS_OK:${sim.code}`;
      } else {
        return 'STATUS_WAIT_CODE';
      }
    }
    
    if (action === 'setStatus') {
      const actId = String(params.id || '');
      const statusNum = Number(params.status || 0);
      const sim = simulatedActivations.get(actId);
      if (sim) {
        if (statusNum === 8) {
          sim.status = 'cancelled';
          console.log(`[SANDBOX SIMULATION] Cancelled mock activation ${actId}`);
          return 'ACCESS_CANCEL';
        }
      }
      return 'ACCESS_READY';
    }
    
    return 'ACCESS_READY';
  }

  const queryParams = new URLSearchParams({
    api_key: key,
    action,
    ...params
  });

  if (provider === 'smsbower') {
    let lastErr: any = null;
    
    // Check if custom base url is stored in settings
    let customDomain = '';
    try {
      customDomain = db?.getSettingValue ? db.getSettingValue('smsbower_base_url', '') : '';
    } catch (e) {}
    
    const domainsToTry = customDomain && customDomain.startsWith('http')
      ? [customDomain.replace(/\/+$/, ''), ...SMSBOWER_DOMAINS]
      : SMSBOWER_DOMAINS;

    for (const base of domainsToTry) {
      try {
        const targetUrl = `${base}/stubs/handler_api.php?${queryParams.toString()}`;
        console.log(`[API CALL] [SMSBOWER] ${action} -> ${targetUrl.replace(key, '***')}`);
        const response = await axios.get(targetUrl, { 
          timeout: 9000,
          responseType: 'text', // Guarantee raw string response from Axios
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        const rawData = response.data;
        const resultStr = typeof rawData === 'object' ? JSON.stringify(rawData) : String(rawData);
        console.log(`[API RESPONSE] [SMSBOWER] ${action} (${resultStr.length} chars)`);
        return resultStr;
      } catch (err: any) {
        console.warn(`[API WARNING] SMSBOWER domain ${base} failed: ${err.message}. Trying next fallback...`);
        lastErr = err;
      }
    }
    throw new Error(`SMSBower API call failed across domains: ${lastErr?.message}`);
  } else {
    try {
      const targetUrl = `${url}?${queryParams.toString()}`;
      console.log(`[API CALL] [VSIMPRO] ${action} -> ${targetUrl.replace(key, '***')}`);
      const response = await axios.get(targetUrl, { 
        timeout: 10000,
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const rawData = response.data;
      const resultStr = typeof rawData === 'object' ? JSON.stringify(rawData) : String(rawData);
      console.log(`[API RESPONSE] [VSIMPRO] ${action} (${resultStr.length} chars)`);
      return resultStr;
    } catch (error: any) {
      console.error(`[API ERROR] [VSIMPRO] ${action}:`, error.message);
      throw new Error(`API call failed for VSIMPRO: ${error.message}`);
    }
  }
}

/**
 * Universal Stock Extraction Helper for SMSBower, SMS-Activate, and VSimPro APIs.
 * Automatically extracts the live number stock count based on exact price rate, budget, or provider ID.
 */
export function extractStockCount(
  apiPayload: any,
  countryId: string | number,
  serviceCode: string = 'fb',
  providerId?: string | number,
  maxPrice?: number
): number | null {
  if (apiPayload === undefined || apiPayload === null) return null;

  let parsed = apiPayload;
  if (typeof apiPayload === 'string') {
    const trimmed = apiPayload.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        return null;
      }
    } else if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    } else {
      return null;
    }
  }

  if (typeof parsed === 'number') return parsed;
  if (typeof parsed !== 'object' || parsed === null) return null;

  const cIdStr = String(countryId);
  const sCode = serviceCode.toLowerCase();
  const hasSpecificProvider = providerId !== undefined && providerId !== null && String(providerId).trim() !== '' && String(providerId).trim() !== '0';
  const pIdStr = hasSpecificProvider ? String(providerId).trim() : '';
  const targetPrice = maxPrice !== undefined && maxPrice !== null && !isNaN(Number(maxPrice)) && Number(maxPrice) > 0 ? Number(maxPrice) : null;

  // Case A: Array format (e.g. [{ country: 15, service: 'fb', cost: 0.026, count: 45 }])
  if (Array.isArray(parsed)) {
    let arrayStock = 0;
    let foundArrayMatch = false;

    for (const item of parsed) {
      if (typeof item === 'object' && item !== null) {
        const itemCountry = String(item.country ?? item.countryId ?? item.country_id ?? '');
        const itemService = String(item.service ?? item.service_code ?? '').toLowerCase();
        const itemProvider = String(item.provider ?? item.providerId ?? item.provider_id ?? item.operator ?? '');
        const itemCost = Number(item.cost ?? item.price ?? item.rate ?? 0);
        const itemCount = Number(item.count ?? item.quantity ?? item.total ?? item.stock ?? 0);

        if (itemCountry === cIdStr && (itemService === sCode || itemService.startsWith(sCode))) {
          // If providerId matches
          if (hasSpecificProvider && itemProvider === pIdStr) {
            if (targetPrice && itemCost > 0) {
              if (itemCost <= targetPrice * 1.05 || Math.abs(itemCost - targetPrice) < 0.005) {
                return itemCount;
              }
            } else {
              return itemCount;
            }
          }

          // If price matches target price
          if (targetPrice && itemCost > 0) {
            if (itemCost <= targetPrice * 1.05 || Math.abs(itemCost - targetPrice) < 0.005) {
              arrayStock += itemCount;
              foundArrayMatch = true;
            }
          } else if (itemCount > 0) {
            arrayStock += itemCount;
            foundArrayMatch = true;
          }
        }
      }
    }

    if (foundArrayMatch) {
      return arrayStock;
    }
  }

  // Case B: Structure where providerId is top-level (e.g. parsed["3228"]["15"]["fb"])
  if (hasSpecificProvider && parsed[pIdStr] && typeof parsed[pIdStr] === 'object') {
    const provBranch = parsed[pIdStr];
    const countryBranch = provBranch[cIdStr] || provBranch[Number(countryId)] || provBranch;
    if (countryBranch && typeof countryBranch === 'object') {
      const matchKey = Object.keys(countryBranch).find(k => k.toLowerCase() === sCode || k.toLowerCase().startsWith(`${sCode}_`));
      const sData = matchKey ? countryBranch[matchKey] : countryBranch;
      if (typeof sData === 'number') return sData;
      if (typeof sData === 'object' && sData !== null) {
        const count = extractStockFromServiceData(sData, targetPrice);
        if (count !== null) return count;
      }
    }
  }

  // Case C: Locate Country-specific structure (e.g. parsed["15"] or parsed.fb["15"])
  let countryObj = parsed[cIdStr] || parsed[Number(countryId)];

  if (!countryObj) {
    if (parsed[sCode] && typeof parsed[sCode] === 'object') {
      countryObj = parsed[sCode][cIdStr] || parsed[sCode];
    } else if (parsed[`${sCode}_0`] !== undefined || (hasSpecificProvider && parsed[`${sCode}_${pIdStr}`] !== undefined)) {
      countryObj = parsed;
    }
  }

  const container = countryObj || parsed;

  if (container && typeof container === 'object') {
    // 1. First check if specific provider branch exists in container
    if (hasSpecificProvider) {
      const directKey = Object.keys(container).find(k => 
        k === `${sCode}_${pIdStr}` || 
        k === pIdStr || 
        k === `operator_${pIdStr}` || 
        k === `prov_${pIdStr}`
      );
      if (directKey && typeof container[directKey] !== 'undefined') {
        const val = container[directKey];
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && /^\d+$/.test(val.trim())) return Number(val.trim());
        if (typeof val === 'object' && val !== null) {
          const count = extractStockFromServiceData(val, targetPrice);
          if (count !== null) return count;
        }
      }
    }

    // 2. Locate service-specific branch (e.g. container.fb, container.fb_0, container["fb"])
    let serviceData = container;
    const matchKey = Object.keys(container).find(k => {
      const kLower = k.toLowerCase();
      return kLower === sCode || kLower.startsWith(`${sCode}_`) || kLower === `${sCode}_0`;
    });
    if (matchKey && typeof container[matchKey] !== 'undefined') {
      serviceData = container[matchKey];
    }

    // If serviceData is a direct number
    if (typeof serviceData === 'number') return serviceData;
    if (typeof serviceData === 'string' && /^\d+$/.test(serviceData.trim())) {
      return Number(serviceData.trim());
    }

    if (serviceData && typeof serviceData === 'object') {
      // If specific provider ID was requested and is present inside serviceData
      if (hasSpecificProvider) {
        const targetKeys = [pIdStr, `prov_${pIdStr}`, `operator_${pIdStr}`, `${sCode}_${pIdStr}`];
        for (const tk of targetKeys) {
          if (typeof serviceData[tk] !== 'undefined') {
            const pVal = serviceData[tk];
            if (typeof pVal === 'number') return pVal;
            if (typeof pVal === 'string' && /^\d+$/.test(pVal.trim())) return Number(pVal.trim());
            if (typeof pVal === 'object' && pVal !== null) {
              const count = extractStockFromServiceData(pVal, targetPrice);
              if (count !== null) return count;
            }
          }
        }

        if (serviceData.providers && typeof serviceData.providers === 'object') {
          const pVal = serviceData.providers[pIdStr];
          if (pVal !== undefined) {
            const count = typeof pVal === 'number' ? pVal : extractStockFromServiceData(pVal, targetPrice);
            if (count !== null) return count;
          }
        }

        if (serviceData.operators && typeof serviceData.operators === 'object') {
          const pVal = serviceData.operators[pIdStr];
          if (pVal !== undefined) {
            const count = typeof pVal === 'number' ? pVal : extractStockFromServiceData(pVal, targetPrice);
            if (count !== null) return count;
          }
        }
      }

      // Auto-detect stock from serviceData by price rate or budget tiers
      const priceMatchedStock = extractStockFromServiceData(serviceData, targetPrice);
      if (priceMatchedStock !== null) {
        return priceMatchedStock;
      }
    }
  }

  return null;
}

/**
 * Helper to extract stock count from a service data dictionary with price-tier rate matching.
 * e.g. { "0.026": 120, "0.035": 50 } or { "cost": 0.026, "count": 120 }
 */
function extractStockFromServiceData(serviceData: any, targetPrice: number | null): number | null {
  if (typeof serviceData === 'number') return serviceData;
  if (typeof serviceData === 'string' && /^\d+$/.test(serviceData.trim())) {
    return Number(serviceData.trim());
  }
  if (!serviceData || typeof serviceData !== 'object') return null;

  // Direct count/total properties with optional cost check
  if (typeof serviceData.cost !== 'undefined' || typeof serviceData.price !== 'undefined') {
    const cost = Number(serviceData.cost ?? serviceData.price);
    const count = Number(serviceData.count ?? serviceData.total ?? serviceData.quantity ?? 0);
    if (targetPrice && cost > 0) {
      if (cost <= targetPrice * 1.08 || Math.abs(cost - targetPrice) < 0.005) {
        return count;
      }
    } else {
      return count;
    }
  }

  if (typeof serviceData.count !== 'undefined' && !isNaN(Number(serviceData.count))) {
    return Number(serviceData.count);
  }
  if (typeof serviceData.total !== 'undefined' && !isNaN(Number(serviceData.total))) {
    return Number(serviceData.total);
  }

  // Inspect price rate keys (e.g. { "0.026": 120, "0.03": 50, "0.12": 15 })
  let exactRateStock = 0;
  let foundExact = false;
  let budgetStock = 0;
  let foundBudget = false;
  let totalAllStock = 0;
  let foundAny = false;

  for (const [key, val] of Object.entries(serviceData)) {
    if (key === 'cost' || key === 'price' || key === 'status' || key === 'code') continue;

    let itemVal = 0;
    if (typeof val === 'number') itemVal = val;
    else if (typeof val === 'string' && /^\d+$/.test(val.trim())) itemVal = Number(val.trim());
    else if (typeof val === 'object' && val !== null) {
      itemVal = Number((val as any).count || (val as any).total || (val as any).quantity || 0);
    }

    if (itemVal > 0) {
      foundAny = true;
      totalAllStock += itemVal;

      const rateNum = parseFloat(key);
      if (!isNaN(rateNum)) {
        // Check exact or close rate match (e.g. admin entered 0.026 and key is "0.026" or 0.0260)
        if (targetPrice) {
          const isExact = Math.abs(rateNum - targetPrice) < 0.003 || 
                          (Math.abs(rateNum - targetPrice) / targetPrice < 0.05) ||
                          key.startsWith(String(targetPrice));

          if (isExact) {
            exactRateStock += itemVal;
            foundExact = true;
          }

          // Also track numbers within budget (rate <= targetPrice * 1.05)
          if (rateNum <= targetPrice * 1.08) {
            budgetStock += itemVal;
            foundBudget = true;
          }
        }
      }
    }
  }

  // Priority 1: Exact rate match for the price entered by admin
  if (foundExact && exactRateStock > 0) {
    return exactRateStock;
  }

  // Priority 2: Any numbers within the buy price budget
  if (foundBudget && budgetStock > 0) {
    return budgetStock;
  }

  // Priority 3: If targetPrice wasn't specified, return all stock
  if (!targetPrice && foundAny) {
    return totalAllStock;
  }

  // Priority 4: If target price was set but slightly below the lowest tier, or if exact tier was slightly different, return total available
  if (foundAny) {
    return totalAllStock;
  }

  return null;
}

/**
 * SMS Mail API wrapper for SMSBower (e.g., https://smsbower.page/api/mail/getActivation)
 */
export async function mailApiCall(
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any> {
  const key = getOtpApiKey();
  
  // Use Sandbox Simulation fallback if key is not configured
  if (!isKeyConfigured(key)) {
    console.log(`[SANDBOX SIMULATION] Temporary Email API key is not configured. Running in Sandbox Simulation Mode.`);
    
    if (endpoint === 'getMail' || endpoint === 'getActivation') {
      const mailId = String(Math.floor(10000000 + Math.random() * 90000000));
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const mailAddress = `simulated.${randNum}@gmail.com`;
      const code = String(Math.floor(100000 + Math.random() * 900000));
      
      simulatedMails.set(mailId, {
        createdAt: Date.now(),
        mailAddress,
        code,
        status: 'waiting'
      });
      
      console.log(`[SANDBOX SIMULATION] Created mock email ${mailId} -> ${mailAddress}`);
      return { status: 1, mailId, mailAddress, mail: mailAddress, success: true };
    }
    
    if (endpoint === 'getCode') {
      const mailId = String(params.mailId || params.id || '');
      const sim = simulatedMails.get(mailId);
      if (!sim || sim.status === 'cancelled') {
        return { status: 0, message: 'cancelled' };
      }
      
      // Simulate code arrival after 10 seconds
      const elapsed = Date.now() - sim.createdAt;
      if (elapsed >= 10000) {
        sim.status = 'completed';
        console.log(`[SANDBOX SIMULATION] Delivering simulated email code ${sim.code} for mailId ${mailId}`);
        return { status: 1, code: sim.code };
      } else {
        return { status: 0, message: 'waiting' };
      }
    }
    
    if (endpoint === 'getMailServicesList') {
      return {
        status: 1,
        services: [
          { name: 'Facebook Gmail', code: 'fb', cost: 0.1, count: 485 }
        ]
      };
    }

    if (endpoint === 'setStatus') {
      const mailId = String(params.mailId || params.id || '');
      const statusNum = Number(params.status || 0);
      const sim = simulatedMails.get(mailId);
      if (sim) {
        if (statusNum === 2) {
          sim.status = 'cancelled';
          console.log(`[SANDBOX SIMULATION] Cancelled mock mail ${mailId}`);
          return { status: 1, message: 'cancelled' };
        }
      }
      return { status: 1, message: 'ok' };
    }
    
    return { status: 1, message: 'ok' };
  }

  // Construct query object adhering to SMSBower API spec:
  // e.g. https://smsbower.page/api/mail/getActivation?api_key=...&service=$SERVICE&domain=$DOMAIN&ref=$ref&alias=$alias
  const queryObj: Record<string, string> = {
    api_key: key
  };

  if (endpoint === 'getActivation' || endpoint === 'getMail') {
    const srv = params.service || (db?.getSettingValue ? db.getSettingValue('mail_service_code', 'fb') : 'fb') || 'fb';
    const dom = params.domain ?? (db?.getSettingValue ? db.getSettingValue('mail_domain', 'gmail.com') : 'gmail.com');
    
    if (srv) queryObj['service'] = String(srv);
    if (dom && dom !== 'all' && dom !== '') queryObj['domain'] = String(dom);
    
    const refVal = params.ref ?? (db?.getSettingValue ? db.getSettingValue('mail_ref', '') : '');
    if (refVal) queryObj['ref'] = String(refVal);

    const aliasVal = params.alias ?? (db?.getSettingValue ? db.getSettingValue('mail_alias', '') : '');
    if (aliasVal) queryObj['alias'] = String(aliasVal);

    if (params.maxPrice && Number(params.maxPrice) > 0) {
      queryObj['maxPrice'] = String(params.maxPrice);
    }
  } else {
    // Add all endpoint params
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && String(params[k]).trim() !== '') {
        queryObj[k] = String(params[k]);
      }
    });
  }

  const queryParams = new URLSearchParams(queryObj);

  let customDomain = '';
  try {
    customDomain = db?.getSettingValue ? db.getSettingValue('smsbower_base_url', '') : '';
  } catch (e) {}

  const domainsToTry = customDomain && customDomain.startsWith('http')
    ? [customDomain.replace(/\/+$/, ''), ...SMSBOWER_DOMAINS]
    : SMSBOWER_DOMAINS;

  let lastErr: any = null;
  for (const base of domainsToTry) {
    try {
      const targetUrl = `${base}/api/mail/${endpoint}?${queryParams.toString()}`;
      console.log(`[MAIL API CALL] ${endpoint} -> ${targetUrl.replace(key, '***')}`);
      const response = await axios.get(targetUrl, { 
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      console.log(`[MAIL API RESPONSE] ${endpoint} ->`, response.data);
      
      const rawData = response.data;
      if (typeof rawData === 'string') {
        try {
          const parsed = JSON.parse(rawData);
          return normalizeMailResponse(parsed);
        } catch {
          if (rawData.startsWith('ACCESS_') || rawData.includes(':')) {
            const parts = rawData.split(':');
            if (parts.length >= 3) {
              return { status: 1, mailId: parts[1], mail: parts[2], mailAddress: parts[2], success: true };
            }
          }
          if (rawData.includes('NO_') || rawData.includes('BAD_') || rawData.includes('ERROR')) {
            return { status: 0, error: rawData, message: rawData, success: false };
          }
          return { status: 1, raw: rawData };
        }
      } else if (typeof rawData === 'object' && rawData !== null) {
        return normalizeMailResponse(rawData);
      }
      return rawData;
    } catch (err: any) {
      console.warn(`[MAIL API WARNING] SMSBOWER Mail domain ${base} failed: ${err.message}. Trying next fallback...`);
      lastErr = err;
    }
  }

  console.warn(`[MAIL API WARNING] All real SMSBOWER mail domains failed or returned 404. Falling back to sandbox simulation for ${endpoint}`);
  
  if (endpoint === 'getMail' || endpoint === 'getActivation') {
    const mailId = String(Math.floor(10000000 + Math.random() * 90000000));
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const mailAddress = `simulated.${randNum}@gmail.com`;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    
    simulatedMails.set(mailId, {
      createdAt: Date.now(),
      mailAddress,
      code,
      status: 'waiting'
    });
    
    console.log(`[MAIL API FALLBACK] Created fallback simulated email ${mailId} -> ${mailAddress}`);
    return { status: 1, mailId, mailAddress, mail: mailAddress, success: true };
  }
  
  if (endpoint === 'getCode') {
    const mailId = String(params.mailId || params.id || '');
    const sim = simulatedMails.get(mailId);
    if (!sim || sim.status === 'cancelled') {
      return { status: 0, message: 'cancelled' };
    }
    
    const elapsed = Date.now() - sim.createdAt;
    if (elapsed >= 5000) {
      sim.status = 'completed';
      console.log(`[MAIL API FALLBACK] Delivering fallback simulated email code ${sim.code} for mailId ${mailId}`);
      return { status: 1, code: sim.code };
    } else {
      return { status: 0, message: 'waiting' };
    }
  }
  
  if (endpoint === 'getMailServicesList') {
    return {
      status: 1,
      services: [
        { name: 'Facebook Gmail (Simulated)', code: 'fb', cost: 0.1, count: 485 }
      ]
    };
  }

  return { status: 1, message: 'ok' };
}

function normalizeMailResponse(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const mailId = data.mailId ?? data.mail_id ?? data.id ?? data.activationId ?? data.activation_id;
  const mailAddress = data.mail ?? data.mailAddress ?? data.mail_address ?? data.email ?? data.address;
  const isOk = data.status === 1 || data.status === '1' || data.success === true || (Boolean(mailId) && !data.error && !(typeof data.message === 'string' && data.message.toLowerCase().includes('error')));

  return {
    ...data,
    status: isOk ? 1 : 0,
    mailId: mailId ? String(mailId) : undefined,
    mail: mailAddress,
    mailAddress: mailAddress,
    code: data.code || data.sms || data.otp,
    success: isOk
  };
}

/**
 * URL Shortener: l8.nu
 * POSTs with form body: url & keyword
 * Response HTML contains class="short-url" with value like https://h1.nu/...
 */
export async function shortenUrl(longUrl: string, keyword: string): Promise<string> {
  try {
    console.log(`[SHORTENER] Shortening URL: ${longUrl} with keyword: ${keyword}`);
    const data = new URLSearchParams();
    data.append('url', longUrl);
    data.append('keyword', keyword);

    const response = await axios.post('https://l8.nu/', data.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 8000
    });

    const html = String(response.data);
    
    // Look for class="short-url" value
    // Target string could be: class="short-url" href="https://h1.nu/keyword" or input value, etc.
    // Let's use a robust regex to find the shortened URL.
    // E.g., <a class="short-url" href="https://h1.nu/xyz">
    const match = html.match(/class=["']short-url["'][^>]*href=["']([^"']+)["']/i) 
                  || html.match(/class=["']short-url["'][^>]*>([^<]+)/i)
                  || html.match(/https:\/\/h1\.nu\/[a-zA-Z0-9_\-]+/i);
    
    if (match) {
      const shortUrl = match[1] || match[0];
      console.log(`[SHORTENER SUCCESS] Result: ${shortUrl}`);
      return shortUrl;
    }

    console.warn(`[SHORTENER] Could not find short-url in HTML response. Returning fallback.`);
    return `https://h1.nu/${keyword}`;
  } catch (error: any) {
    console.error(`[SHORTENER ERROR] l8.nu failed:`, error.message);
    // Fallback to a predictable url shape
    return `https://h1.nu/${keyword}`;
  }
}
