import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: string;
      isGuest: boolean;
    };
    accessToken?: string;
    refreshToken?: string;
  }

  interface User {
    id: string;
    role: string;
    isGuest: boolean;
    accessToken: string;
    refreshToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    isGuest: boolean;
    /**
     * ⚠️ Заавал биш (`?`) — backend access token 15 минутын настай тул
     * 30 хоногийн session дотор хугацаа нь дуусч, refresh амжилтгүй болвол
     * `undefined` болгож session-ийг хүчингүйд тооцдог.
     */
    accessToken?: string;
    refreshToken?: string;
    /** Access token хэзээ дуусах (мс) — урьдчилж шинэчлэхэд ашиглана */
    accessExpires?: number;
  }
}
