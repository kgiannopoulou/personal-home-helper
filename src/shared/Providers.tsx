import type { ReactNode } from 'react';
import { ProactiveProvider } from '../modules/assistant/lib/useProactive';
import { StoreProvider as ActivityProvider } from '../modules/activity/lib/store';
import { StoreProvider as ChoresProvider } from '../modules/chores/lib/store';
import { StoreProvider as FoodProvider } from '../modules/food/lib/store';
import { StoreProvider as KitchenProvider } from '../modules/kitchen/lib/store';
import { StoreProvider as MoneyProvider } from '../modules/money/lib/store';
import { StoreProvider as PlannerProvider } from '../modules/planner/lib/store';
import { StoreProvider as ShoppingProvider } from '../modules/shopping/lib/store';
import { StoreProvider as WeatherProvider } from '../modules/weather/lib/store';

/**
 * Every module keeps its own state and storage key, exactly as in the standalone apps.
 * They're all mounted here, so the hub and modules can read and update each other directly.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <FoodProvider>
      <ActivityProvider>
        <KitchenProvider>
          <ShoppingProvider>
            <MoneyProvider>
              <ChoresProvider>
                <PlannerProvider>
                  <WeatherProvider>
                    {/* Last, because the assistant reads every module */}
                    <ProactiveProvider>{children}</ProactiveProvider>
                  </WeatherProvider>
                </PlannerProvider>
              </ChoresProvider>
            </MoneyProvider>
          </ShoppingProvider>
        </KitchenProvider>
      </ActivityProvider>
    </FoodProvider>
  );
}
