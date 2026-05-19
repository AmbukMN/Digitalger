import { Suspense } from 'react';
import { Loading } from '@digitalger/shared/ui';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading label="..." />}>
      <LoginForm />
    </Suspense>
  );
}
