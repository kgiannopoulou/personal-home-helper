import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Chip, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { APPLIANCE_PRESETS, applianceCost, energyTotal, money } from '../../modules/money/lib/budget';
import { useStore } from '../../modules/money/lib/store';
import type { Appliance } from '../../modules/money/lib/types';

const num = (v: string) => Number(v.replace(',', '.'));

function ApplianceRow({ a }: { a: Appliance }) {
  const { state, updateAppliance, removeAppliance } = useStore();
  const c = state.settings.currency;
  const cost = applianceCost(a, state.settings.kwhPrice);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(String(a.hoursPerDay));
  const [days, setDays] = useState(String(a.daysPerMonth));
  const [kw, setKw] = useState(String(a.kw));

  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={styles.progressHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>{a.name}</Text>
          <Muted>
            {a.kw} kW · {a.hoursPerDay} h/day · {a.daysPerMonth} days · {cost.kwhPerMonth} kWh
          </Muted>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.label}>{money(cost.perMonth, c)}/mo</Text>
          <Muted>{money(cost.perDay, c)}/day</Muted>
        </View>
      </Pressable>
      {cost.oneHourLess >= 1 && !open && (
        <Muted>💡 One hour less a day saves {money(cost.oneHourLess, c)} a month.</Muted>
      )}
      {open && (
        <View style={{ marginTop: 10 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Power (kW)" value={kw} onChangeText={setKw} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Hours/day" value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Days/month" value={days} onChangeText={setDays} keyboardType="number-pad" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                label="Save"
                disabled={!(num(kw) > 0) || !(num(hours) >= 0 && num(hours) <= 24) || !(num(days) >= 0 && num(days) <= 31)}
                onPress={() => {
                  updateAppliance(a.id, { kw: num(kw), hoursPerDay: num(hours), daysPerMonth: Math.round(num(days)) });
                  setOpen(false);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Remove" variant="danger" onPress={() => removeAppliance(a.id)} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function Energy() {
  const { state, addAppliance, setSettings } = useStore();
  const { settings } = state;
  const c = settings.currency;
  const total = energyTotal(state.appliances, settings.kwhPrice);
  const [price, setPrice] = useState(String(settings.kwhPrice));
  const [name, setName] = useState('');
  const [kw, setKw] = useState('');
  const [hours, setHours] = useState('');

  useEffect(() => setPrice(String(settings.kwhPrice)), [settings.kwhPrice]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>Heating & appliances: {money(total, c)}/month</Title>
        <Muted>
          How much your heater, humidifier or AC costs to run. Tap an appliance to change how long you use it. Power is
          on the label, usually in watts (2000 W = 2 kW).
        </Muted>
        <View style={{ height: 12 }} />
        <View style={[styles.row, { alignItems: 'flex-end' }]}>
          <View style={{ flex: 1 }}>
            <Field label={`Electricity price (${c.trim()} per kWh)`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          </View>
          <View style={{ marginBottom: 12 }}>
            <Button
              label="Save"
              variant="secondary"
              disabled={!(num(price) > 0) || num(price) === settings.kwhPrice}
              onPress={() => setSettings({ ...settings, kwhPrice: num(price) })}
            />
          </View>
        </View>
        {state.appliances.length === 0 && <Muted>Add an appliance below to see what it costs.</Muted>}
        {state.appliances.map((a) => (
          <ApplianceRow key={a.id} a={a} />
        ))}
      </Card>

      <Card>
        <Title>Add an appliance</Title>
        <View style={styles.row}>
          {APPLIANCE_PRESETS.map((p) => (
            <Chip key={p.name} label={`+ ${p.name}`} onPress={() => addAppliance(p)} />
          ))}
        </View>
        <View style={{ height: 12 }} />
        <Field label="Or your own" value={name} onChangeText={setName} placeholder="e.g. Bedroom heater" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Power (kW)" value={kw} onChangeText={setKw} keyboardType="decimal-pad" placeholder="2" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Hours per day" value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="4" />
          </View>
        </View>
        <Button
          label="Add"
          disabled={!name.trim() || !(num(kw) > 0) || !(num(hours) > 0 && num(hours) <= 24)}
          onPress={() => {
            addAppliance({ name: name.trim(), kw: num(kw), hoursPerDay: num(hours), daysPerMonth: 30 });
            setName('');
            setKw('');
            setHours('');
          }}
        />
      </Card>
    </ScrollView>
  );
}
