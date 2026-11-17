import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from './client';
import type { AcademicRule, AcademicRuleInput } from '@shared/academicRules';
export const ACADEMIC_RULES_KEY=['academic-rules'];
export const useAcademicRules=()=>useQuery({queryKey:ACADEMIC_RULES_KEY,queryFn:()=>request<AcademicRule[]>('GET','/academic-rules')});
export function useSaveAcademicRule(){const query=useQueryClient();return useMutation({mutationFn:(input:AcademicRuleInput)=>request<AcademicRule>('PUT','/academic-rules',input),onSuccess:()=>query.invalidateQueries({queryKey:ACADEMIC_RULES_KEY}),onError:()=>query.invalidateQueries({queryKey:ACADEMIC_RULES_KEY})});}
export function useDeleteAcademicRule(){const query=useQueryClient();return useMutation({mutationFn:(id:number)=>request('DELETE',`/academic-rules/${id}`),onSuccess:()=>query.invalidateQueries({queryKey:ACADEMIC_RULES_KEY})});}
