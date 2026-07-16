import { createBrowserRouter } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Start } from './pages/Start';
import { Checkout } from './pages/Checkout';
import { Report } from './pages/Report';
import { Status } from './pages/Status';
import { Privacy, Refunds, Terms } from './pages/Legal';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/start', element: <Start /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/report/:slug', element: <Report /> },
  { path: '/status/:orderId', element: <Status /> },
  { path: '/terms', element: <Terms /> },
  { path: '/privacy', element: <Privacy /> },
  { path: '/refunds', element: <Refunds /> },
]);
