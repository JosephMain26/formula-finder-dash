
CREATE TABLE public.technicians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_name TEXT NOT NULL,
  phone_number TEXT,
  city TEXT,
  percentage NUMERIC DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view technicians" ON public.technicians FOR SELECT USING (true);
CREATE POLICY "Anyone can create technicians" ON public.technicians FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update technicians" ON public.technicians FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete technicians" ON public.technicians FOR DELETE USING (true);

CREATE TRIGGER update_technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
