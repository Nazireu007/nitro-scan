export type RecommendedHardwareMode = 'serial' | 'simulator' | 'manual' | 'unsupported_serial_but_app_ok';

export type PlatformCapabilities = {
  isMobile: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isWebSerialSupported: boolean;
  isSecureContext: boolean;
  userAgentSummary: string;
  recommendedMode: RecommendedHardwareMode;
};

function operatingSystem(userAgent: string, platform: string, touchPoints: number): string {
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent) || (/mac/i.test(platform) && touchPoints > 1)) return 'iOS/iPadOS';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Sistema não identificado';
}

function browserName(userAgent: string): string {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/crios\//i.test(userAgent)) return 'Chrome iOS';
  if (/chrome\//i.test(userAgent)) return 'Chrome';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/safari\//i.test(userAgent)) return 'Safari';
  return 'Navegador web';
}

export function detectPlatformCapabilities(): PlatformCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isDesktop: true,
      isTouch: false,
      isWebSerialSupported: false,
      isSecureContext: false,
      userAgentSummary: 'Ambiente sem navegador',
      recommendedMode: 'manual',
    };
  }

  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const touchPoints = navigator.maxTouchPoints || 0;
  const ipadDesktopAgent = /mac/i.test(platform) && touchPoints > 1;
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent) || ipadDesktopAgent;
  const isTouch = touchPoints > 0 || 'ontouchstart' in window;
  const isWebSerialSupported = 'serial' in navigator;
  const isSecureContext = window.isSecureContext;
  const isDesktop = !isMobile;

  let recommendedMode: RecommendedHardwareMode;
  if (isMobile) recommendedMode = 'simulator';
  else if (isWebSerialSupported && isSecureContext) recommendedMode = 'serial';
  else recommendedMode = 'unsupported_serial_but_app_ok';

  return {
    isMobile,
    isDesktop,
    isTouch,
    isWebSerialSupported,
    isSecureContext,
    userAgentSummary: `${operatingSystem(userAgent, platform, touchPoints)} / ${browserName(userAgent)}`,
    recommendedMode,
  };
}

export function directSerialGuidance(capabilities: PlatformCapabilities): string {
  if (capabilities.isMobile) {
    return 'Modo mobile ativo. Simulador, entrada estruturada e análise offline disponíveis.';
  }
  if (!capabilities.isSecureContext) {
    return 'A conexão serial exige HTTPS e um navegador desktop compatível.';
  }
  if (!capabilities.isWebSerialSupported) {
    return 'Conexão direta indisponível neste navegador. Modo simulado/manual ativo.';
  }
  return 'Serial disponível. Conecte a Nitro Box quando o hardware estiver pronto.';
}
