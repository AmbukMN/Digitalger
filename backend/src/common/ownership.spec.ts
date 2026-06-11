import { ForbiddenException } from '@nestjs/common';
import {
  isSuperadmin,
  isEditor,
  buildOwnerWhere,
  assertOwner,
  assertCanDelete,
} from './ownership';
import { JwtPayload } from './decorators/current-user.decorator';

const superadmin: JwtPayload = { sub: 'sa1', email: 'sa@x.mn', role: 'SUPERADMIN' };
const admin1: JwtPayload = { sub: 'a1', email: 'a1@x.mn', role: 'ADMIN' };
const admin2: JwtPayload = { sub: 'a2', email: 'a2@x.mn', role: 'ADMIN' };
const editor1: JwtPayload = { sub: 'e1', email: 'e1@x.mn', role: 'EDITOR' };

describe('ownership helpers', () => {
  describe('role шалгалт', () => {
    it('isSuperadmin', () => {
      expect(isSuperadmin(superadmin)).toBe(true);
      expect(isSuperadmin(admin1)).toBe(false);
      expect(isSuperadmin(null)).toBe(false);
    });
    it('isEditor', () => {
      expect(isEditor(editor1)).toBe(true);
      expect(isEditor(admin1)).toBe(false);
    });
  });

  describe('buildOwnerWhere', () => {
    it('SUPERADMIN → {} (бүгд)', () => {
      expect(buildOwnerWhere(superadmin)).toEqual({});
    });
    it('ADMIN → зөвхөн өөрийн createdByUserId', () => {
      expect(buildOwnerWhere(admin1)).toEqual({ createdByUserId: 'a1' });
    });
    it('EDITOR → зөвхөн өөрийн', () => {
      expect(buildOwnerWhere(editor1)).toEqual({ createdByUserId: 'e1' });
    });
  });

  describe('assertOwner (IDOR хаалт)', () => {
    it('SUPERADMIN → бүх контентыг засна', () => {
      expect(() => assertOwner(superadmin, { createdByUserId: 'a2' })).not.toThrow();
      expect(() => assertOwner(superadmin, { createdByUserId: null })).not.toThrow();
    });
    it('ADMIN өөрийн контент → OK', () => {
      expect(() => assertOwner(admin1, { createdByUserId: 'a1' })).not.toThrow();
    });
    it('🔴 ADMIN ӨӨР admin-ийн контент → Forbidden (IDOR)', () => {
      expect(() => assertOwner(admin1, { createdByUserId: 'a2' })).toThrow(ForbiddenException);
    });
    it('🔴 ADMIN эзэнгүй (null) контент → Forbidden', () => {
      expect(() => assertOwner(admin1, { createdByUserId: null })).toThrow(ForbiddenException);
    });
    it('мөр байхгүй → Forbidden', () => {
      expect(() => assertOwner(admin1, null)).toThrow(ForbiddenException);
    });
  });

  describe('assertCanDelete', () => {
    it('SUPERADMIN/ADMIN устгаж чадна', () => {
      expect(() => assertCanDelete(superadmin)).not.toThrow();
      expect(() => assertCanDelete(admin1)).not.toThrow();
    });
    it('🔴 EDITOR устгаж ЧАДАХГҮЙ', () => {
      expect(() => assertCanDelete(editor1)).toThrow(ForbiddenException);
    });
  });

  describe('бодит сценари: Admin2 нь Admin1-ийн product-д хүрэх', () => {
    it('Admin2 Admin1-ийн product засах оролдлого → 403', () => {
      const product = { createdByUserId: admin1.sub };
      expect(() => assertOwner(admin2, product, 'засах')).toThrow(ForbiddenException);
    });
    it('Admin2 Admin1-ийн product устгах → 403', () => {
      const product = { createdByUserId: admin1.sub };
      expect(() => assertOwner(admin2, product, 'устгах')).toThrow(ForbiddenException);
    });
    it('SUPERADMIN Admin1-ийн product засах → OK', () => {
      const product = { createdByUserId: admin1.sub };
      expect(() => assertOwner(superadmin, product, 'засах')).not.toThrow();
    });
  });
});
