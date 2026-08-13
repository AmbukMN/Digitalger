import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      /**
       * ⚠️⚠️ МЭССЕЖ МОНГОЛ БАЙХ ЁСТОЙ — энэ нь хэрэглэгчид ШУУД
       * toast-оор харагддаг. «Authentication required» гэсэн англи
       * бичиг гарч хэрэглэгч юу болсныг ойлгодоггүй байв
       * (хэрэглэгчийн скриншот).
       *
       * ⚠️ Frontend нь энэ мессежийг шууд харуулдаг тул орчуулга
       * ЭНД байх ёстой (client талд дахин mapping хийвэл шинэ
       * endpoint нэмэх бүрд мартагдана).
       */
      throw err ?? new UnauthorizedException('Нэвтэрч орно уу');
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
